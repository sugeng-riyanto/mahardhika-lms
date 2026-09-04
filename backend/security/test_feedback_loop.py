"""
Feedback-loop tests — the closed instructor ⇄ student learning cycle.

These tests exercise the full loop the LMS exists for: instructor authors
work → student responds/attempts → instructor grades and releases feedback
→ student and linked parent see released results — plus the RBAC walls that
keep other students, unrelated instructors, and parents from over-reaching.

Covered:
- Essay lifecycle (author → respond → submit → grade → release → view)
- Grade CRUD with release workflow
- Activity attempt lifecycle (start → submit → result)
- Cross-role denial (other student, unrelated instructor, parent, student-author)
"""
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from essays.models import EssayQuestion, EssayResponse, RubricCriterion
from gradebook.models import Grade
from activities.models import ActivityDefinition
from courses.models import Lesson, Enrolment


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lesson(db, sample_course):
    return Lesson.objects.create(
        course=sample_course,
        title='Feedback Lesson',
        order=1,
        content_type='text',
        content_data={'body': 'Lesson content'},
        is_published=True,
    )


@pytest.fixture
def activity(db, organisation, lesson, instructor_user):
    return ActivityDefinition.objects.create(
        title='Feedback Quiz',
        activity_type='multiple_choice',
        organisation=organisation,
        lesson=lesson,
        created_by=instructor_user,
        status='published',
        max_attempts=3,
        pass_mark_percentage=60,
        settings={},
    )


@pytest.fixture
def enrolment(db, sample_course, student_user):
    return Enrolment.objects.create(
        student=student_user, course=sample_course, status='active',
    )


def _auth(client, user):
    client.force_authenticate(user=user)


def _create_question(client, course):
    return client.post('/api/v1/essays/questions/', {
        'title': 'Newton Second Law',
        'description': 'Explain F=ma with a worked example.',
        'course': str(course.id),
        'marks': 10,
        'status': 'published',
    }, format='json')


def _create_criterion(client, question_id):
    return client.post('/api/v1/essays/criteria/', {
        'question': question_id,
        'name': 'Method',
        'description': 'Correct approach',
        'max_score': 5,
    }, format='json')


def _full_essay_loop(student_client, instructor_client, question_id, criterion_id):
    """Drive one complete essay: student responds/submits, instructor grades/releases."""
    res = student_client.post('/api/v1/essays/responses/', {
        'question': question_id,
        'typed_answer': 'F = ma, so a = F/m...',
    }, format='json')
    assert res.status_code in (201, 200), res.data
    response_id = res.data['id']

    res = student_client.post(f'/api/v1/essays/responses/{response_id}/submit/', {}, format='json')
    assert res.status_code == 200, res.data
    assert res.data['status'] == 'submitted'

    res = instructor_client.post(
        f'/api/v1/essays/responses/{response_id}/start-grading/', {}, format='json',
    )
    assert res.status_code == 200, res.data

    res = instructor_client.post('/api/v1/essays/scores/', {
        'response': response_id,
        'criterion': criterion_id,
        'score': 4,
        'comment': 'Good method',
    }, format='json')
    assert res.status_code in (201, 200), res.data

    res = instructor_client.post(
        f'/api/v1/essays/responses/{response_id}/release-grade/', {}, format='json',
    )
    assert res.status_code == 200, res.data
    assert res.data['status'] == 'finalised'
    assert res.data['feedback_released'] is True

    return response_id


@pytest.mark.django_db
class TestEssayFeedbackLoop:
    """Full essay lifecycle: instructor authors, student responds, instructor grades, feedback flows back."""

    def test_full_essay_loop(self, api_client, instructor_user, student_user,
                             parent_user, sample_course):
        _auth(api_client, instructor_user)
        qres = _create_question(api_client, sample_course)
        assert qres.status_code in (201, 200)
        qid = qres.data['id']

        cres = _create_criterion(api_client, qid)
        assert cres.status_code in (201, 200)
        cid = cres.data['id']

        student_client = APIClient()
        _auth(student_client, student_user)
        rid = _full_essay_loop(student_client, api_client, qid, cid)

        # Student sees released feedback
        res = student_client.get(f'/api/v1/essays/responses/{rid}/')
        assert res.status_code == 200
        assert res.data['feedback_released'] is True

        # Parent sees child's released response in the list
        parent_client = APIClient()
        _auth(parent_client, parent_user)
        res = parent_client.get('/api/v1/essays/responses/')
        assert res.status_code == 200
        results = res.data.get('results', res.data)
        assert any(r['id'] == rid for r in results)

    def test_other_student_cannot_submit_or_view(self, api_client, instructor_user,
                                                 student_user, organisation, roles,
                                                 sample_course, sample_programme):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        other = User.objects.create_user(
            email='other-student@test.com', password='testpass123',
            supabase_uid='other-student-uid', full_name='Other Student',
        )
        RoleAssignment = __import__('identity.models', fromlist=['RoleAssignment']).RoleAssignment
        RoleAssignment.objects.create(
            user=other, role=roles['student'], organisation=organisation, status='active',
        )
        Enrolment.objects.create(student=other, course=sample_course, status='active')

        _auth(api_client, instructor_user)
        qres = _create_question(api_client, sample_course)
        qid = qres.data['id']
        cres = _create_criterion(api_client, qid)
        cid = cres.data['id']

        student_client = APIClient()
        _auth(student_client, student_user)
        rid = _full_essay_loop(student_client, api_client, qid, cid)

        # Other student cannot submit the first student's response
        _auth(api_client, other)
        res = api_client.post(f'/api/v1/essays/responses/{rid}/submit/', {}, format='json')
        assert res.status_code in (403, 404)

        # Other student cannot view it (queryset-scoped → 404)
        res = api_client.get(f'/api/v1/essays/responses/{rid}/')
        assert res.status_code in (403, 404)

    def test_student_cannot_author_or_score(self, api_client, student_user, sample_course):
        _auth(api_client, student_user)
        res = _create_question(api_client, sample_course)
        assert res.status_code == 403


@pytest.mark.django_db
class TestGradeCRUDWorkflow:
    """Grade CRUD with release: instructor writes, student reads released only."""

    def _create_grade(self, api_client, instructor_user, student_user, activity):
        _auth(api_client, instructor_user)
        res = api_client.post('/api/v1/grades/', {
            'student': str(student_user.id),
            'activity': str(activity.id),
            'score': 8,
            'max_score': 10,
        }, format='json')
        assert res.status_code in (201, 200), res.data
        return res.data['id']

    def test_instructor_create_release_student_read(self, api_client, instructor_user,
                                                   student_user, activity, enrolment):
        gid = self._create_grade(api_client, instructor_user, student_user, activity)

        _auth(api_client, instructor_user)
        res = api_client.post(f'/api/v1/grades/{gid}/release/', {}, format='json')
        assert res.status_code == 200

        _auth(api_client, student_user)
        res = api_client.get('/api/v1/grades/')
        assert res.status_code == 200
        results = res.data.get('results', res.data)
        assert any(g['id'] == gid and g['released'] for g in results)

    def test_student_cannot_update_or_delete(self, api_client, instructor_user,
                                            student_user, activity, enrolment):
        gid = self._create_grade(api_client, instructor_user, student_user, activity)

        # Grade is unreleased, so the student's queryset (released-only) hides it → 404;
        # either way the student cannot modify it.
        _auth(api_client, student_user)
        res = api_client.patch(f'/api/v1/grades/{gid}/', {'score': 10}, format='json')
        assert res.status_code in (403, 404)

        res = api_client.delete(f'/api/v1/grades/{gid}/')
        assert res.status_code in (403, 404, 405)

    def test_instructor_cannot_delete_grade(self, api_client, instructor_user,
                                            student_user, activity, enrolment):
        gid = self._create_grade(api_client, instructor_user, student_user, activity)

        _auth(api_client, instructor_user)
        res = api_client.delete(f'/api/v1/grades/{gid}/')
        assert res.status_code == 403  # delete is owner/admin only


@pytest.mark.django_db
class TestAttemptLifecycle:
    """Student starts an attempt, submits, and sees the auto-scored result; instructor sees it."""

    def test_student_attempt_and_instructor_visibility(self, api_client, student_user,
                                                      instructor_user, activity, enrolment):
        _auth(api_client, student_user)
        res = api_client.post('/api/v1/attempts/', {'activity': str(activity.id)}, format='json')
        assert res.status_code in (201, 200), res.data
        attempt_id = res.data['id']

        res = api_client.post(f'/api/v1/attempts/{attempt_id}/submit/', {}, format='json')
        assert res.status_code == 200
        assert res.data['status'] == 'submitted'

        res = api_client.get(f'/api/v1/attempts/{attempt_id}/result/')
        assert res.status_code == 200

        # Instructor sees the student's attempt in their course
        _auth(api_client, instructor_user)
        res = api_client.get('/api/v1/attempts/')
        assert res.status_code == 200
        results = res.data.get('results', res.data)
        assert any(a['id'] == attempt_id for a in results)

    def test_non_student_cannot_create_attempt(self, api_client, instructor_user, activity):
        _auth(api_client, instructor_user)
        res = api_client.post('/api/v1/attempts/', {'activity': str(activity.id)}, format='json')
        assert res.status_code == 403


@pytest.mark.django_db
class TestFeedbackLoopWalls:
    """Parent and unrelated-instructor walls around the feedback loop."""

    def test_parent_cannot_grade(self, api_client, instructor_user, student_user,
                                 parent_user, sample_course):
        _auth(api_client, instructor_user)
        qres = _create_question(api_client, sample_course)
        qid = qres.data['id']
        cres = _create_criterion(api_client, qid)
        cid = cres.data['id']

        student_client = APIClient()
        _auth(student_client, student_user)
        rid = _full_essay_loop(student_client, api_client, qid, cid)

        parent_client = APIClient()
        _auth(parent_client, parent_user)
        res = parent_client.post(
            f'/api/v1/essays/responses/{rid}/start-grading/', {}, format='json',
        )
        assert res.status_code == 403

    def test_unrelated_instructor_cannot_grade(self, api_client, instructor_user,
                                               student_user, organisation, roles,
                                               sample_course, sample_programme):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        other_instructor = User.objects.create_user(
            email='other-instructor@test.com', password='testpass123',
            supabase_uid='other-instructor-uid', full_name='Other Instructor',
        )
        RoleAssignment = __import__('identity.models', fromlist=['RoleAssignment']).RoleAssignment
        RoleAssignment.objects.create(
            user=other_instructor, role=roles['instructor'], organisation=organisation,
            status='active',
        )

        _auth(api_client, instructor_user)
        qres = _create_question(api_client, sample_course)
        qid = qres.data['id']
        cres = _create_criterion(api_client, qid)
        cid = cres.data['id']

        student_client = APIClient()
        _auth(student_client, student_user)
        rid = _full_essay_loop(student_client, api_client, qid, cid)

        other_client = APIClient()
        _auth(other_client, other_instructor)
        res = other_client.post(
            f'/api/v1/essays/responses/{rid}/start-grading/', {}, format='json',
        )
        assert res.status_code in (403, 404)
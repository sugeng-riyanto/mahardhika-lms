"""Tests for Grade API endpoints: CRUD, release, bulk-release, revoke, and RBAC."""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from gradebook.models import Grade, GradeEvent
from activities.models import ActivityDefinition
from courses.models import Programme, Course, Lesson

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def programme(db, organisation):
    return Programme.objects.create(
        organisation=organisation, name='Physics', slug='physics', level='shs',
    )


@pytest.fixture
def course(db, organisation, programme, instructor_user):
    return Course.objects.create(
        programme=programme, organisation=organisation,
        title='Physics 101', slug='phys-101', instructor=instructor_user, is_published=True,
    )


@pytest.fixture
def lesson(db, course):
    return Lesson.objects.create(
        course=course, title='Kinematics', order=1, content_type='text', is_published=True,
    )


@pytest.fixture
def activity(db, organisation, lesson):
    act = ActivityDefinition.objects.create(
        organisation=organisation, title='Quiz 1', activity_type='multiple_choice', status='published',
    )
    act.lesson = lesson
    act.save()
    return act


@pytest.fixture
def activity2(db, organisation, lesson):
    act = ActivityDefinition.objects.create(
        organisation=organisation, title='Quiz 2', activity_type='multiple_choice', status='published',
    )
    act.lesson = lesson
    act.save()
    return act


@pytest.fixture
def grade_unreleased(db, student_user, activity):
    return Grade.objects.create(
        student=student_user, activity=activity,
        score=Decimal('85.00'), max_score=Decimal('100.00'), released=False,
    )


@pytest.fixture
def grade_released(db, student_user, activity2):
    return Grade.objects.create(
        student=student_user, activity=activity2,
        score=Decimal('90.00'), max_score=Decimal('100.00'), released=True, released_at=timezone.now(),
    )


# ─── Grade API CRUD ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGradeAPICRUD:
    def test_instructor_can_create_grade(self, api_client, instructor_user, student_user, activity):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/grades/', {
            'student': str(student_user.id),
            'activity': str(activity.id),
            'score': '85.00',
            'max_score': '100.00',
        }, format='json')
        assert res.status_code in (201, 200)

    def test_student_cannot_create_grade(self, api_client, student_user, activity):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/grades/', {
            'student': str(student_user.id),
            'activity': str(activity.id),
            'score': '85.00',
            'max_score': '100.00',
        }, format='json')
        assert res.status_code == 403

    def test_student_sees_only_released_grades(self, api_client, student_user, grade_unreleased, grade_released):
        api_client.force_authenticate(user=student_user)
        res = api_client.get('/api/v1/grades/')
        assert res.status_code == 200
        ids = [g['id'] for g in res.data['results']]
        assert str(grade_released.id) in ids
        assert str(grade_unreleased.id) not in ids

    def test_instructor_sees_all_org_grades(self, api_client, instructor_user, grade_unreleased, grade_released):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get('/api/v1/grades/')
        assert res.status_code == 200
        ids = [g['id'] for g in res.data['results']]
        assert str(grade_unreleased.id) in ids
        assert str(grade_released.id) in ids

    def test_admin_sees_all_org_grades(self, api_client, admin_user, grade_unreleased, grade_released):
        api_client.force_authenticate(user=admin_user)
        res = api_client.get('/api/v1/grades/')
        assert res.status_code == 200
        assert res.data['count'] == 2

    def test_percentage_calculated(self, api_client, instructor_user, grade_unreleased):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get(f'/api/v1/grades/{grade_unreleased.id}/')
        assert res.status_code == 200
        assert res.data['percentage'] == 85.0

    def test_letter_grade_calculated(self, api_client, instructor_user, grade_released):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get(f'/api/v1/grades/{grade_released.id}/')
        assert res.status_code == 200
        assert res.data['letter_grade'] == 'A+'  # 90/100 = 90%


# ─── Grade Release ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGradeReleaseAPI:
    def test_instructor_can_release(self, api_client, instructor_user, grade_unreleased):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post(f'/api/v1/grades/{grade_unreleased.id}/release/')
        assert res.status_code == 200
        grade_unreleased.refresh_from_db()
        assert grade_unreleased.released is True
        assert grade_unreleased.released_at is not None

    def test_cannot_release_already_released(self, api_client, instructor_user, grade_released):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post(f'/api/v1/grades/{grade_released.id}/release/')
        assert res.status_code == 400

    def test_release_creates_event(self, api_client, instructor_user, grade_unreleased):
        api_client.force_authenticate(user=instructor_user)
        api_client.post(f'/api/v1/grades/{grade_unreleased.id}/release/')
        event = GradeEvent.objects.filter(grade=grade_unreleased, reason='Grade released to student').first()
        assert event is not None


# ─── Bulk Release ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBulkReleaseAPI:
    def test_bulk_release_by_activity(self, api_client, instructor_user, grade_unreleased):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/grades/bulk-release/', {
            'activity_id': str(grade_unreleased.activity.id),
        }, format='json')
        assert res.status_code == 200
        assert res.data['released_count'] == 1
        grade_unreleased.refresh_from_db()
        assert grade_unreleased.released is True

    def test_bulk_release_by_ids(self, api_client, instructor_user, grade_unreleased):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/grades/bulk-release/', {
            'grade_ids': [str(grade_unreleased.id)],
        }, format='json')
        assert res.status_code == 200
        assert res.data['released_count'] == 1

    def test_bulk_release_requires_params(self, api_client, instructor_user):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/grades/bulk-release/', {}, format='json')
        assert res.status_code == 400

    def test_student_cannot_bulk_release(self, api_client, student_user, grade_unreleased):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/grades/bulk-release/', {
            'activity_id': str(grade_unreleased.activity.id),
        }, format='json')
        assert res.status_code == 403


# ─── Grade Revoke ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGradeRevokeAPI:
    def test_admin_can_revoke(self, api_client, admin_user, grade_released):
        api_client.force_authenticate(user=admin_user)
        res = api_client.post(f'/api/v1/grades/{grade_released.id}/revoke/')
        assert res.status_code == 200
        grade_released.refresh_from_db()
        assert grade_released.released is False
        assert grade_released.released_at is None

    def test_instructor_cannot_revoke(self, api_client, instructor_user, grade_released):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post(f'/api/v1/grades/{grade_released.id}/revoke/')
        assert res.status_code == 403

    def test_cannot_revoke_unreleased(self, api_client, admin_user, grade_unreleased):
        api_client.force_authenticate(user=admin_user)
        res = api_client.post(f'/api/v1/grades/{grade_unreleased.id}/revoke/')
        assert res.status_code == 400

    def test_revoke_creates_event(self, api_client, admin_user, grade_released):
        api_client.force_authenticate(user=admin_user)
        api_client.post(f'/api/v1/grades/{grade_released.id}/revoke/')
        event = GradeEvent.objects.filter(grade=grade_released).order_by('-created_at').first()
        assert event is not None


# ─── Grade Delete ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGradeDeleteAPI:
    def test_admin_can_delete(self, api_client, admin_user, grade_unreleased):
        api_client.force_authenticate(user=admin_user)
        res = api_client.delete(f'/api/v1/grades/{grade_unreleased.id}/')
        assert res.status_code in (204, 200)
        assert not Grade.objects.filter(id=grade_unreleased.id).exists()

    def test_instructor_cannot_delete(self, api_client, instructor_user, grade_unreleased):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.delete(f'/api/v1/grades/{grade_unreleased.id}/')
        assert res.status_code == 403

    def test_student_cannot_delete(self, api_client, student_user, grade_released):
        api_client.force_authenticate(user=student_user)
        res = api_client.delete(f'/api/v1/grades/{grade_released.id}/')
        assert res.status_code == 403

"""Tests for Essay API endpoints: questions, responses, rubric, RBAC."""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from essays.models import (
    EssayQuestion, EssayResponse, RubricCriterion,
    RubricLevel, RubricScore, InlineFeedback,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def question(db, sample_course, instructor_user):
    return EssayQuestion.objects.create(
        title='Physics Essay', description='Explain F=ma',
        content_data={'body': 'A 5kg block...'}, marks=100,
        status='published', course=sample_course, created_by=instructor_user,
    )


@pytest.fixture
def draft_question(db, sample_course, instructor_user):
    return EssayQuestion.objects.create(
        title='Draft Essay', description='Not yet published',
        status='draft', course=sample_course, created_by=instructor_user,
    )


@pytest.fixture
def rubric(db, question):
    c = RubricCriterion.objects.create(
        question=question, name='Reasoning', max_score=Decimal('50.00'), order=1,
    )
    RubricLevel.objects.create(criterion=c, label='Excellent', score=Decimal('50.00'))
    RubricLevel.objects.create(criterion=c, label='Good', score=Decimal('35.00'))
    return c


@pytest.fixture
def response_draft(db, question, student_user):
    return EssayResponse.objects.create(
        question=question, student=student_user,
        typed_answer='F = ma, a = 20/5 = 4 m/s²',
        status='draft', version=1,
    )


@pytest.fixture
def response_submitted(db, question, student_user):
    return EssayResponse.objects.create(
        question=question, student=student_user,
        typed_answer='Final answer with detailed steps...',
        status='submitted', submitted_at=timezone.now(), version=1,
    )


# ─── Question API Tests ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestEssayQuestionAPI:
    def test_instructor_can_list_questions(self, api_client, instructor_user, question):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get('/api/v1/essays/questions/')
        assert res.status_code == 200

    def test_student_can_list_questions(self, api_client, student_user, question):
        api_client.force_authenticate(user=student_user)
        res = api_client.get('/api/v1/essays/questions/')
        assert res.status_code == 200

    def test_instructor_can_create_question(self, api_client, instructor_user, sample_course):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/essays/questions/', {
            'title': 'New Essay',
            'description': 'Write about energy conservation',
            'marks': 50,
            'status': 'draft',
            'course': str(sample_course.id),
        }, format='json')
        assert res.status_code in (201, 200)

    def test_student_cannot_create_question(self, api_client, student_user, sample_course):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/questions/', {
            'title': 'Hacked Essay',
            'marks': 100,
            'course': str(sample_course.id),
        }, format='json')
        assert res.status_code == 403

    def test_retrieve_question(self, api_client, instructor_user, question):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get(f'/api/v1/essays/questions/{question.id}/')
        assert res.status_code == 200
        assert res.data['title'] == 'Physics Essay'

    def test_update_question(self, api_client, instructor_user, question):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'description': 'Updated description',
        }, format='json')
        assert res.status_code == 200
        question.refresh_from_db()
        assert question.description == 'Updated description'


# ─── Response API Tests ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestEssayResponseAPI:
    def test_student_can_create_response(self, api_client, student_user, question):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'My answer...',
        }, format='json')
        assert res.status_code in (201, 200)

    def test_student_can_list_own_responses(self, api_client, student_user, response_submitted):
        api_client.force_authenticate(user=student_user)
        res = api_client.get('/api/v1/essays/responses/')
        assert res.status_code == 200

    def test_instructor_can_list_responses(self, api_client, instructor_user, response_submitted):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get('/api/v1/essays/responses/')
        assert res.status_code == 200

    def test_retrieve_response(self, api_client, student_user, response_submitted):
        api_client.force_authenticate(user=student_user)
        res = api_client.get(f'/api/v1/essays/responses/{response_submitted.id}/')
        assert res.status_code == 200

    def test_submit_draft(self, api_client, student_user, response_draft):
        api_client.force_authenticate(user=student_user)
        res = api_client.patch(f'/api/v1/essays/responses/{response_draft.id}/', {
            'status': 'submitted',
        }, format='json')
        assert res.status_code == 200
        response_draft.refresh_from_db()
        assert response_draft.status == 'submitted'


# ─── Rubric Criterion API Tests ──────────────────────────────────────────


@pytest.mark.django_db
class TestRubricCriterionAPI:
    def test_list_criteria(self, api_client, instructor_user, rubric):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get('/api/v1/essays/criteria/')
        assert res.status_code == 200

    def test_instructor_can_create_criterion(self, api_client, instructor_user, question):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/essays/criteria/', {
            'question': str(question.id),
            'name': 'New Criterion',
            'max_score': '25.00',
            'order': 1,
        }, format='json')
        assert res.status_code in (201, 200)

    def test_student_cannot_create_criterion(self, api_client, student_user, question):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/criteria/', {
            'question': str(question.id),
            'name': 'Hacked Criterion',
            'max_score': '25.00',
        }, format='json')
        assert res.status_code == 403


# ─── Rubric Score API Tests ──────────────────────────────────────────────


@pytest.mark.django_db
class TestRubricScoreAPI:
    def test_instructor_can_score(self, api_client, instructor_user, response_submitted, rubric):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/essays/scores/', {
            'response': str(response_submitted.id),
            'criterion': str(rubric.id),
            'score': '40.00',
        }, format='json')
        assert res.status_code in (201, 200)

    def test_student_cannot_score(self, api_client, student_user, response_submitted, rubric):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/scores/', {
            'response': str(response_submitted.id),
            'criterion': str(rubric.id),
            'score': '50.00',
        }, format='json')
        assert res.status_code == 403

    def test_scoring_updates_response_totals(self, api_client, instructor_user, response_submitted, rubric):
        api_client.force_authenticate(user=instructor_user)
        api_client.post('/api/v1/essays/scores/', {
            'response': str(response_submitted.id),
            'criterion': str(rubric.id),
            'score': '45.00',
        }, format='json')
        response_submitted.refresh_from_db()
        assert response_submitted.total_score == Decimal('45.00')


# ─── Inline Feedback API Tests ───────────────────────────────────────────


@pytest.mark.django_db
class TestInlineFeedbackAPI:
    def test_instructor_can_create_feedback(self, api_client, instructor_user, response_submitted):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/essays/feedback/', {
            'response': str(response_submitted.id),
            'anchor_type': 'text',
            'comment': 'Good formula usage!',
            'text_start': 0,
            'text_end': 10,
        }, format='json')
        assert res.status_code in (201, 200)

    def test_student_cannot_create_feedback(self, api_client, student_user, response_submitted):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/feedback/', {
            'response': str(response_submitted.id),
            'anchor_type': 'general',
            'comment': 'Self-evaluation',
        }, format='json')
        assert res.status_code == 403

    def test_list_feedback(self, api_client, instructor_user, response_submitted):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get('/api/v1/essays/feedback/')
        assert res.status_code == 200


# ─── Unauthenticated Access ─────────────────────────────────────────────


# ─── Idempotent Response Create ─────────────────────────────────────────


@pytest.mark.django_db
class TestEssayResponseIdempotentCreate:
    """POST /essays/responses/ twice with same question+student returns 200
    with the existing draft instead of 500 on the unique constraint."""

    def test_first_create_returns_201(self, api_client, student_user, question):
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'My first draft',
        }, format='json')
        assert res.status_code == 201
        assert res.data['status'] == 'draft'

    def test_duplicate_create_returns_200_existing_draft(self, api_client, student_user, question):
        """Second POST with same question+student returns the existing draft."""
        api_client.force_authenticate(user=student_user)
        # First POST — creates the draft
        res1 = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'Draft one',
        }, format='json')
        assert res1.status_code == 201
        first_id = res1.data['id']

        # Second POST — should return existing, not 500
        res2 = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'Draft two (ignored)',
        }, format='json')
        assert res2.status_code == 200
        assert res2.data['id'] == first_id
        assert res2.data['status'] == 'draft'

    def test_idempotent_create_does_not_duplicate(self, api_client, student_user, question):
        api_client.force_authenticate(user=student_user)
        api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'x',
        }, format='json')
        api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'y',
        }, format='json')
        count = EssayResponse.objects.filter(question=question, student=student_user).count()
        assert count == 1

    def test_idempotent_only_for_drafts(self, api_client, student_user, question):
        """After submitting, a new create should produce a new response (version 2)."""
        api_client.force_authenticate(user=student_user)
        res1 = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'v1',
        }, format='json')
        rid = res1.data['id']
        # Submit it
        api_client.post(f'/api/v1/essays/responses/{rid}/submit/', format='json')
        # Create again — should be a new response, not the submitted one
        res2 = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'v2',
        }, format='json')
        assert res2.status_code == 201
        assert res2.data['id'] != rid
        assert res2.data['status'] == 'draft'


# ─── Rubric Criteria Materialization ──────────────────────────────────────


@pytest.mark.django_db
class TestRubricCriteriaMaterialization:
    """content_data.rubric_criteria in question create/update should produce
    real RubricCriterion rows, and removal should delete them."""

    def test_create_question_materializes_criteria(self, api_client, instructor_user, sample_course):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/essays/questions/', {
            'title': 'Rubric Test',
            'description': 'Test',
            'marks': 100,
            'status': 'published',
            'course': str(sample_course.id),
            'content_data': {
                'rubric_criteria': [
                    {'name': 'Analysis', 'max_score': 60, 'description': 'Depth of analysis'},
                    {'name': 'Clarity', 'max_score': 40, 'description': 'Writing clarity'},
                ],
            },
        }, format='json')
        assert res.status_code in (201, 200)
        qid = res.data['id']
        criteria = RubricCriterion.objects.filter(question_id=qid)
        assert criteria.count() == 2
        names = set(criteria.values_list('name', flat=True))
        assert names == {'Analysis', 'Clarity'}
        assert criteria.get(name='Analysis').max_score == Decimal('60')
        assert criteria.get(name='Clarity').max_score == Decimal('40')

    def test_update_question_syncs_criteria(self, api_client, instructor_user, question):
        """PATCHing content_data.rubric_criteria should add/remove/update criteria."""
        api_client.force_authenticate(user=instructor_user)
        # Add two criteria
        api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'content_data': {
                'rubric_criteria': [
                    {'name': 'A', 'max_score': 30, 'description': ''},
                    {'name': 'B', 'max_score': 70, 'description': ''},
                ],
            },
        }, format='json')
        assert RubricCriterion.objects.filter(question=question).count() == 2

        # Update: change A's score, remove B, add C
        api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'content_data': {
                'rubric_criteria': [
                    {'name': 'A', 'max_score': 50, 'description': 'Updated'},
                    {'name': 'C', 'max_score': 50, 'description': ''},
                ],
            },
        }, format='json')
        criteria = RubricCriterion.objects.filter(question=question)
        assert criteria.count() == 2
        names = set(criteria.values_list('name', flat=True))
        assert names == {'A', 'C'}
        assert criteria.get(name='A').max_score == Decimal('50')
        assert criteria.get(name='A').description == 'Updated'

    def test_remove_criteria_deletes_if_no_scores(self, api_client, instructor_user, question):
        """Criteria without scores should be deleted when removed from content_data."""
        api_client.force_authenticate(user=instructor_user)
        api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'content_data': {
                'rubric_criteria': [
                    {'name': 'X', 'max_score': 100, 'description': ''},
                ],
            },
        }, format='json')
        assert RubricCriterion.objects.filter(question=question, name='X').exists()

        # Remove X
        api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'content_data': {'rubric_criteria': []},
        }, format='json')
        assert not RubricCriterion.objects.filter(question=question, name='X').exists()

    def test_remove_criteria_keeps_if_scores_exist(self, api_client, instructor_user, question, student_user):
        """Criteria with scores should NOT be deleted even if removed from content_data."""
        api_client.force_authenticate(user=instructor_user)
        # Create a criterion
        api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'content_data': {
                'rubric_criteria': [
                    {'name': 'Scored', 'max_score': 100, 'description': ''},
                ],
            },
        }, format='json')
        crit = RubricCriterion.objects.get(question=question, name='Scored')

        # Create a response and score it
        api_client.force_authenticate(user=student_user)
        res = api_client.post('/api/v1/essays/responses/', {
            'question': str(question.id),
            'typed_answer': 'Answer',
        }, format='json')
        rid = res.data['id']

        api_client.force_authenticate(user=instructor_user)
        api_client.post('/api/v1/essays/scores/', {
            'response': str(rid),
            'criterion': str(crit.id),
            'score': '80.00',
        }, format='json')

        # Try to remove the criterion via content_data update
        api_client.patch(f'/api/v1/essays/questions/{question.id}/', {
            'content_data': {'rubric_criteria': []},
        }, format='json')
        # Criterion should still exist because scores reference it
        assert RubricCriterion.objects.filter(id=crit.id).exists()

    def test_criteria_appear_in_question_response(self, api_client, instructor_user, sample_course):
        """GET /questions/:id/ should include rubric_criteria in the response."""
        api_client.force_authenticate(user=instructor_user)
        res = api_client.post('/api/v1/essays/questions/', {
            'title': 'Visible Rubric',
            'marks': 50,
            'status': 'published',
            'course': str(sample_course.id),
            'content_data': {
                'rubric_criteria': [
                    {'name': 'Criterion A', 'max_score': 25, 'description': ''},
                ],
            },
        }, format='json')
        qid = res.data['id']
        detail = api_client.get(f'/api/v1/essays/questions/{qid}/')
        assert detail.status_code == 200
        criteria = detail.data.get('rubric_criteria', [])
        assert len(criteria) == 1
        assert criteria[0]['name'] == 'Criterion A'
        assert float(criteria[0]['max_score']) == 25.0


# ─── Unauthenticated Access ─────────────────────────────────────────────
    def test_questions_requires_auth(self, api_client):
        res = api_client.get('/api/v1/essays/questions/')
        assert res.status_code in (401, 403)

    def test_responses_requires_auth(self, api_client):
        res = api_client.get('/api/v1/essays/responses/')
        assert res.status_code in (401, 403)

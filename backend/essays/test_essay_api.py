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


@pytest.mark.django_db
class TestEssayUnauthenticated:
    def test_questions_requires_auth(self, api_client):
        res = api_client.get('/api/v1/essays/questions/')
        assert res.status_code in (401, 403)

    def test_responses_requires_auth(self, api_client):
        res = api_client.get('/api/v1/essays/responses/')
        assert res.status_code in (401, 403)

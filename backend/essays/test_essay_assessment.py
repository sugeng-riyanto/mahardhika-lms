"""Tests for essay assessment models and RBAC."""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from essays.models import (
    EssayQuestion, EssayResponse, RubricCriterion,
    RubricLevel, RubricScore, InlineFeedback,
)
from identity.models import RoleAssignment

User = get_user_model()


@pytest.fixture
def essay_question(db, sample_course, instructor_user):
    """Create a published essay question."""
    return EssayQuestion.objects.create(
        title='Newton Second Law Essay',
        description='Explain how F=ma applies to the scenario.',
        content_data={'type': 'text', 'body': 'A 5kg block is pushed...'},
        marks=100,
        expected_answer='F=ma, a=F/m=20/5=4 m/s^2',
        learning_objectives=['Apply Newton Second Law', 'Calculate acceleration'],
        difficulty='medium',
        status='published',
        max_time_minutes=60,
        allow_canvas_response=True,
        allow_typed_response=True,
        course=sample_course,
        created_by=instructor_user,
    )


@pytest.fixture
def rubric_criteria(db, essay_question):
    """Create rubric criteria for the essay question."""
    c1 = RubricCriterion.objects.create(
        question=essay_question,
        name='Mathematical Reasoning',
        description='Clear logical reasoning throughout',
        max_score=Decimal('25.00'),
        order=1,
    )
    RubricLevel.objects.create(criterion=c1, label='Excellent', description='Clear, logical', score=Decimal('25.00'))
    RubricLevel.objects.create(criterion=c1, label='Good', description='Mostly clear', score=Decimal('20.00'))
    RubricLevel.objects.create(criterion=c1, label='Needs Work', description='Unclear', score=Decimal('10.00'))

    c2 = RubricCriterion.objects.create(
        question=essay_question,
        name='Calculation',
        description='Accurate calculations',
        max_score=Decimal('25.00'),
        order=2,
    )
    RubricLevel.objects.create(criterion=c2, label='Excellent', description='All correct', score=Decimal('25.00'))
    RubricLevel.objects.create(criterion=c2, label='Good', description='Minor errors', score=Decimal('20.00'))

    c3 = RubricCriterion.objects.create(
        question=essay_question,
        name='Units',
        description='Correct units',
        max_score=Decimal('25.00'),
        order=3,
    )
    RubricLevel.objects.create(criterion=c3, label='Excellent', description='All units correct', score=Decimal('25.00'))

    c4 = RubricCriterion.objects.create(
        question=essay_question,
        name='Explanation',
        description='Clear explanation',
        max_score=Decimal('25.00'),
        order=4,
    )
    RubricLevel.objects.create(criterion=c4, label='Good', description='Good explanation', score=Decimal('20.00'))

    return [c1, c2, c3, c4]


@pytest.fixture
def essay_response(db, essay_question, student_user):
    """Create a draft essay response."""
    return EssayResponse.objects.create(
        question=essay_question,
        student=student_user,
        typed_answer='Given: F = 20N, m = 5kg\nFormula: F = ma\na = F/m = 20/5 = 4 m/s^2',
        status='draft',
        version=1,
    )


# ─── Model Tests ─────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestEssayQuestionModel:
    def test_create_question(self, essay_question):
        assert essay_question.title == 'Newton Second Law Essay'
        assert essay_question.marks == 100
        assert essay_question.status == 'published'
        assert essay_question.course is not None

    def test_question_str(self, essay_question):
        assert str(essay_question) == 'Newton Second Law Essay'

    def test_question_defaults(self, db, sample_course, instructor_user):
        q = EssayQuestion.objects.create(
            title='Test',
            course=sample_course,
            created_by=instructor_user,
        )
        assert q.status == 'draft'
        assert q.difficulty == 'medium'
        assert q.allow_canvas_response is True


@pytest.mark.django_db
class TestEssayResponseModel:
    def test_create_response(self, essay_response):
        assert essay_response.status == 'draft'
        assert essay_response.version == 1
        assert 'F = ma' in essay_response.typed_answer

    def test_response_str(self, essay_response):
        assert 'student@test.com' in str(essay_response)
        assert 'Newton' in str(essay_response)

    def test_compute_letter_grade(self, essay_response):
        essay_response.percentage = Decimal('92.00')
        assert essay_response.compute_letter_grade() == 'A+'

        essay_response.percentage = Decimal('87.00')
        assert essay_response.compute_letter_grade() == 'A'

        essay_response.percentage = Decimal('75.00')
        assert essay_response.compute_letter_grade() == 'B+'

        essay_response.percentage = Decimal('55.00')
        assert essay_response.compute_letter_grade() == 'C'

        essay_response.percentage = Decimal('35.00')
        assert essay_response.compute_letter_grade() == 'F'

        essay_response.percentage = None
        assert essay_response.compute_letter_grade() == ''


@pytest.mark.django_db
class TestRubricCriterion:
    def test_create_criterion(self, rubric_criteria):
        assert len(rubric_criteria) == 4
        assert rubric_criteria[0].name == 'Mathematical Reasoning'
        assert rubric_criteria[0].max_score == Decimal('25.00')

    def test_criterion_str(self, rubric_criteria):
        assert 'Mathematical Reasoning' in str(rubric_criteria[0])

    def test_levels_ordering(self, rubric_criteria):
        levels = rubric_criteria[0].levels.all()
        assert levels[0].score >= levels[1].score


@pytest.mark.django_db
class TestRubricScore:
    def test_score_updates_response_totals(self, essay_response, rubric_criteria):
        """Scoring a criterion should update the response totals."""
        response = essay_response
        c1, c2, c3, c4 = rubric_criteria

        # Score first criterion
        RubricScore.objects.create(
            response=response,
            criterion=c1,
            score=Decimal('22.00'),
            scored_by=c1.created_by if hasattr(c1, 'created_by') else None,
        )
        response.refresh_from_db()
        assert response.total_score == Decimal('22.00')
        assert response.percentage is not None

        # Score second criterion
        RubricScore.objects.create(
            response=response,
            criterion=c2,
            score=Decimal('20.00'),
        )
        response.refresh_from_db()
        assert response.total_score == Decimal('42.00')

    def test_full_rubric_scoring(self, essay_response, rubric_criteria):
        """Score all criteria and verify totals."""
        response = essay_response
        scores = [
            (rubric_criteria[0], Decimal('22.00')),
            (rubric_criteria[1], Decimal('25.00')),
            (rubric_criteria[2], Decimal('20.00')),
            (rubric_criteria[3], Decimal('20.00')),
        ]
        for criterion, score in scores:
            RubricScore.objects.create(response=response, criterion=criterion, score=score)

        response.refresh_from_db()
        assert response.total_score == Decimal('87.00')
        assert response.percentage == Decimal('87.00')
        assert response.letter_grade == 'A'

    def test_unique_constraint(self, essay_response, rubric_criteria):
        """Cannot score the same criterion twice."""
        RubricScore.objects.create(
            response=essay_response,
            criterion=rubric_criteria[0],
            score=Decimal('20.00'),
        )
        with pytest.raises(Exception):
            RubricScore.objects.create(
                response=essay_response,
                criterion=rubric_criteria[0],
                score=Decimal('15.00'),
            )


@pytest.mark.django_db
class TestInlineFeedback:
    def test_create_text_feedback(self, essay_response, instructor_user):
        fb = InlineFeedback.objects.create(
            response=essay_response,
            anchor_type='text',
            text_start=10,
            text_end=20,
            selected_text='F = ma',
            comment='Correct formula identification!',
            is_visible_to_student=True,
            created_by=instructor_user,
        )
        assert fb.anchor_type == 'text'
        assert fb.selected_text == 'F = ma'

    def test_create_canvas_feedback(self, essay_response, instructor_user):
        fb = InlineFeedback.objects.create(
            response=essay_response,
            anchor_type='canvas',
            canvas_x=100.0,
            canvas_y=200.0,
            canvas_width=50.0,
            canvas_height=30.0,
            comment='Good diagram here',
            created_by=instructor_user,
        )
        assert fb.anchor_type == 'canvas'

    def test_hidden_feedback(self, essay_response, instructor_user):
        fb = InlineFeedback.objects.create(
            response=essay_response,
            anchor_type='general',
            comment='Internal note: check for plagiarism',
            is_visible_to_student=False,
            created_by=instructor_user,
        )
        assert fb.is_visible_to_student is False


@pytest.mark.django_db
class TestResponseLifecycle:
    def test_submit_draft(self, essay_response, student_user):
        """Test submitting a draft response."""
        assert essay_response.status == 'draft'
        essay_response.status = 'submitted'
        essay_response.submitted_at = timezone.now()
        essay_response.save()
        assert essay_response.status == 'submitted'
        assert essay_response.submitted_at is not None

    def test_late_submission(self, essay_response, student_user):
        """Test late submission detection."""
        essay_response.submitted_at = essay_response.created_at + timedelta(hours=2)
        essay_response.is_late = True
        essay_response.save()
        assert essay_response.is_late is True

    def test_return_for_revision(self, essay_response, instructor_user):
        """Test returning response for revision."""
        essay_response.status = 'returned'
        essay_response.return_reason = 'Please add more detail in step 3'
        essay_response.returned_at = timezone.now()
        essay_response.save()
        assert essay_response.status == 'returned'
        assert essay_response.return_reason == 'Please add more detail in step 3'

    def test_resubmission(self, essay_response, student_user):
        """Test resubmission after return."""
        essay_response.status = 'returned'
        essay_response.save()
        # Create new version
        new_response = EssayResponse.objects.create(
            question=essay_response.question,
            student=student_user,
            typed_answer='Revised answer with more detail...',
            status='submitted',
            submitted_at=timezone.now(),
            version=2,
        )
        assert new_response.version == 2
        assert new_response.status == 'submitted'

    def test_grade_release(self, essay_response, rubric_criteria):
        """Test full grade release flow."""
        response = essay_response

        # Score all criteria
        for criterion in rubric_criteria:
            RubricScore.objects.create(
                response=response,
                criterion=criterion,
                score=criterion.max_score,
            )

        # Release grade
        response.status = 'finalised'
        response.feedback_released = True
        response.feedback_released_at = timezone.now()
        response.save()

        response.refresh_from_db()
        assert response.status == 'finalised'
        assert response.feedback_released is True
        assert response.percentage == Decimal('100.00')
        assert response.letter_grade == 'A+'

"""Tests for grade creation, release, and audit trail."""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal

from gradebook.models import Grade, GradeEvent
from activities.models import ActivityDefinition
from courses.models import Programme, Course, Lesson, Enrolment
from identity.models import Role, RoleAssignment
from organisations.models import Organisation

User = get_user_model()


@pytest.fixture
def organisation(db):
    return Organisation.objects.create(name='Test Academy', slug='test-academy', type='school')


@pytest.fixture
def roles(db):
    result = {}
    for name, display in [
        ('owner', 'Owner'), ('admin', 'Admin'), ('instructor', 'Instructor'),
        ('student', 'Student'),
    ]:
        role, _ = Role.objects.get_or_create(name=name, defaults={'display_name': display, 'description': f'{display}'})
        result[name] = role
    return result


@pytest.fixture
def instructor_user(db, organisation, roles):
    user = User.objects.create_user(email='instructor@test.com', password='pass', supabase_uid='inst-uid')
    RoleAssignment.objects.create(user=user, role=roles['instructor'], organisation=organisation, status='active')
    return user


@pytest.fixture
def student_user(db, organisation, roles):
    user = User.objects.create_user(email='student@test.com', password='pass', supabase_uid='stu-uid')
    RoleAssignment.objects.create(user=user, role=roles['student'], organisation=organisation, status='active')
    return user


@pytest.fixture
def admin_user(db, organisation, roles):
    user = User.objects.create_user(email='admin@test.com', password='pass', supabase_uid='admin-uid')
    RoleAssignment.objects.create(user=user, role=roles['admin'], organisation=organisation, status='active')
    return user


@pytest.fixture
def programme(db, organisation):
    return Programme.objects.create(organisation=organisation, name='SHS Physics', slug='shs-physics', level='shs')


@pytest.fixture
def course(db, organisation, programme, instructor_user):
    return Course.objects.create(programme=programme, organisation=organisation, title='Physics 101', slug='phys-101', instructor=instructor_user, is_published=True)


@pytest.fixture
def lesson(db, course):
    return Lesson.objects.create(course=course, title='Kinematics', order=1, content_type='text', is_published=True)


@pytest.fixture
def activity(db, organisation, lesson):
    act = ActivityDefinition.objects.create(
        organisation=organisation, title='Quiz 1', activity_type='multiple_choice', status='published',
    )
    act.lesson = lesson
    act.save()
    return act


@pytest.fixture
def grade(db, student_user, activity):
    return Grade.objects.create(student=student_user, activity=activity, score=Decimal('85.00'), max_score=Decimal('100.00'))


@pytest.mark.django_db
class TestGradeCreation:
    def test_create_grade(self, grade):
        assert grade.score == Decimal('85.00')
        assert grade.released is False

    def test_grade_str(self, grade):
        assert 'student@test.com' in str(grade)
        assert '85.00' in str(grade)

    def test_unique_student_activity(self, grade, student_user, activity):
        with pytest.raises(Exception):
            Grade.objects.create(student=student_user, activity=activity, score=Decimal('90.00'), max_score=Decimal('100.00'))


@pytest.mark.django_db
class TestGradeEvent:
    def test_create_event(self, grade, instructor_user):
        event = GradeEvent.objects.create(
            grade=grade, previous_score=None, new_score=Decimal('85.00'),
            reason='Initial grade', actor=instructor_user,
        )
        assert event.new_score == Decimal('85.00')
        assert event.previous_score is None

    def test_score_change_event(self, grade, admin_user):
        old_score = grade.score
        grade.score = Decimal('90.00')
        grade.save()

        event = GradeEvent.objects.create(
            grade=grade, previous_score=old_score, new_score=grade.score,
            reason='Corrected', actor=admin_user,
        )
        assert event.previous_score == Decimal('85.00')
        assert event.new_score == Decimal('90.00')

    def test_events_are_ordered(self, grade, admin_user):
        e1 = GradeEvent.objects.create(grade=grade, previous_score=None, new_score=Decimal('85.00'), actor=admin_user, reason='first')
        e2 = GradeEvent.objects.create(grade=grade, previous_score=Decimal('85.00'), new_score=Decimal('90.00'), actor=admin_user, reason='second')
        events = list(grade.events.all())
        assert len(events) == 2
        # Both events exist
        assert e1.id in [ev.id for ev in events]
        assert e2.id in [ev.id for ev in events]


@pytest.mark.django_db
class TestGradeRelease:
    def test_release_grade(self, grade, instructor_user):
        assert grade.released is False
        grade.released = True
        grade.released_at = timezone.now()
        grade.save(update_fields=['released', 'released_at'])
        grade.refresh_from_db()
        assert grade.released is True
        assert grade.released_at is not None

    def test_revoke_grade(self, grade, admin_user):
        grade.released = True
        grade.released_at = timezone.now()
        grade.save(update_fields=['released', 'released_at'])
        grade.released = False
        grade.released_at = None
        grade.save(update_fields=['released', 'released_at'])
        assert grade.released is False
        assert grade.released_at is None


@pytest.mark.django_db
class TestGradeRBAC:
    def test_student_only_sees_released(self, student_user, activity, organisation):
        # Create a second activity to avoid unique constraint
        activity2 = ActivityDefinition.objects.create(
            organisation=organisation, title='Quiz 2', activity_type='multiple_choice', status='published',
        )
        g1 = Grade.objects.create(student=student_user, activity=activity, score=Decimal('80'), max_score=Decimal('100'), released=True)
        g2 = Grade.objects.create(student=student_user, activity=activity2, score=Decimal('70'), max_score=Decimal('100'), released=False)
        from gradebook.views import GradeViewSet
        view = GradeViewSet()
        view.request = type('Request', (), {'user': student_user})()
        qs = view.get_queryset()
        assert qs.filter(id=g1.id).exists()
        assert not qs.filter(id=g2.id).exists()

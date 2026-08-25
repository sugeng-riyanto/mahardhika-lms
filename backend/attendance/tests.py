"""Tests for attendance models and RBAC."""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, time, timedelta

from attendance.models import LessonSchedule, AttendanceRecord
from courses.models import Course, Programme, Enrolment
from identity.models import RoleAssignment, ParentChildLink

User = get_user_model()


@pytest.fixture
def organisation(db):
    from organisations.models import Organisation
    return Organisation.objects.create(
        name='Test Academy', slug='test-academy', type='school',
    )


@pytest.fixture
def roles(db):
    from identity.models import Role
    result = {}
    for name, display in [
        ('owner', 'Owner'), ('admin', 'Admin'), ('instructor', 'Instructor'),
        ('student', 'Student'), ('parent', 'Parent'),
    ]:
        role, _ = Role.objects.get_or_create(
            name=name, defaults={'display_name': display, 'description': f'{display} role'},
        )
        result[name] = role
    return result


@pytest.fixture
def instructor_user(db, organisation, roles):
    user = User.objects.create_user(
        email='instructor@test.com', password='pass', supabase_uid='inst-uid',
    )
    RoleAssignment.objects.create(user=user, role=roles['instructor'], organisation=organisation, status='active')
    return user


@pytest.fixture
def student_user(db, organisation, roles):
    user = User.objects.create_user(
        email='student@test.com', password='pass', supabase_uid='stu-uid',
    )
    RoleAssignment.objects.create(user=user, role=roles['student'], organisation=organisation, status='active')
    return user


@pytest.fixture
def student_user2(db, organisation, roles):
    user = User.objects.create_user(
        email='student2@test.com', password='pass', supabase_uid='stu2-uid',
    )
    RoleAssignment.objects.create(user=user, role=roles['student'], organisation=organisation, status='active')
    return user


@pytest.fixture
def parent_user(db, organisation, roles, student_user):
    user = User.objects.create_user(
        email='parent@test.com', password='pass', supabase_uid='par-uid',
    )
    RoleAssignment.objects.create(user=user, role=roles['parent'], organisation=organisation, status='active')
    ParentChildLink.objects.create(
        parent_user=user, student_user=student_user,
        is_verified=True, is_active=True, consent_given=True,
    )
    return user


@pytest.fixture
def sample_programme(db, organisation):
    return Programme.objects.create(
        organisation=organisation, name='JHS Math', slug='jhs-math',
        description='Math', level='jhs',
    )


@pytest.fixture
def sample_course(db, organisation, sample_programme, instructor_user):
    return Course.objects.create(
        programme=sample_programme, organisation=organisation,
        title='Math 7A', slug='math-7a', instructor=instructor_user, is_published=True,
    )


@pytest.fixture
def sample_lesson(db, sample_course):
    from courses.models import Lesson
    return Lesson.objects.create(
        course=sample_course, title='Algebra Basics', order=1,
        content_type='text', is_published=True,
    )


@pytest.fixture
def schedule(db, sample_lesson, sample_course):
    return LessonSchedule.objects.create(
        lesson=sample_lesson, course=sample_course,
        date=date.today(), start_time=time(8, 0), end_time=time(9, 30),
        location='Room 201',
    )


@pytest.mark.django_db
class TestLessonScheduleModel:
    def test_create_schedule(self, schedule, sample_lesson, sample_course):
        assert schedule.lesson == sample_lesson
        assert schedule.course == sample_course
        assert schedule.location == 'Room 201'
        assert schedule.is_cancelled is False

    def test_schedule_str(self, schedule):
        assert 'Algebra Basics' in str(schedule)

    def test_unique_lesson_date(self, schedule, sample_lesson, sample_course):
        with pytest.raises(Exception):
            LessonSchedule.objects.create(
                lesson=sample_lesson, course=sample_course,
                date=schedule.date, start_time=time(10, 0),
            )


@pytest.mark.django_db
class TestAttendanceRecordModel:
    def test_create_record(self, schedule, student_user):
        record = AttendanceRecord.objects.create(
            schedule=schedule, student=student_user, status='present',
            notes='On time',
        )
        assert record.status == 'present'
        assert record.notes == 'On time'
        assert record.marked_at is not None

    def test_record_str(self, schedule, student_user):
        record = AttendanceRecord.objects.create(
            schedule=schedule, student=student_user, status='present',
        )
        assert 'student@test.com' in str(record)

    def test_unique_schedule_student(self, schedule, student_user):
        AttendanceRecord.objects.create(
            schedule=schedule, student=student_user, status='present',
        )
        with pytest.raises(Exception):
            AttendanceRecord.objects.create(
                schedule=schedule, student=student_user, status='absent',
            )

    def test_all_statuses(self, schedule, student_user, student_user2):
        # Two students, two statuses each on same schedule (unique constraint)
        AttendanceRecord.objects.create(schedule=schedule, student=student_user, status='present')
        AttendanceRecord.objects.create(schedule=schedule, student=student_user2, status='late')


@pytest.mark.django_db
class TestAttendanceRBAC:
    def test_enrolment_exists(self, student_user, sample_course):
        Enrolment.objects.create(
            student=student_user, course=sample_course, status='active',
        )
        assert Enrolment.objects.filter(student=student_user, course=sample_course).exists()

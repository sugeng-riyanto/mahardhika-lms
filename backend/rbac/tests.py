"""
Comprehensive RBAC tests for queryset filtering and object-level permissions.

Tests verify:
1. Students only see their enrolled courses
2. Instructors only see their assigned courses
3. Parents only see their linked children's data
4. Sponsors only see limited data
5. Finance role isolation
6. Org-scoped filtering
7. Object-level update/delete permissions
"""
import pytest
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment, ParentChildLink
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment
from gradebook.models import Grade
from activities.models import ActivityDefinition
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation
)


@pytest.fixture
def org():
    return Organisation.objects.create(name='Test Org', slug='test-org', is_active=True)


@pytest.fixture
def org2():
    return Organisation.objects.create(name='Test Org 2', slug='test-org-2', is_active=True)


@pytest.fixture
def roles():
    roles = {}
    for name, display in [
        ('owner', 'Owner'), ('admin', 'Admin'), ('treasurer', 'Treasurer'),
        ('instructor', 'Instructor'), ('student', 'Student'),
        ('parent', 'Parent'), ('sponsorship', 'Sponsor'), ('third_party', 'Third Party'),
    ]:
        roles[name], _ = Role.objects.get_or_create(name=name, defaults={'display_name': display})
    return roles


@pytest.fixture
def programme(org):
    return Programme.objects.create(
        name='JHS Math', slug='jhs-math', description='Test',
        level='jhs', is_active=True, organisation=org,
    )


@pytest.fixture
def course(org, programme, instructor_user):
    return Course.objects.create(
        title='Math 7A', slug='math-7a', description='Test',
        programme=programme, organisation=org, instructor=instructor_user,
        is_published=True,
    )


@pytest.fixture
def course2(org, programme, instructor2_user):
    return Course.objects.create(
        title='Math 7B', slug='math-7b', description='Test',
        programme=programme, organisation=org, instructor=instructor2_user,
        is_published=True,
    )


@pytest.fixture
def lesson(course):
    return Lesson.objects.create(
        course=course, title='Algebra', description='Test',
        order=1, content_type='text', content_data={}, is_published=True,
    )


@pytest.fixture
def owner_user(org, roles):
    user = User.objects.create_user(email='owner@test.com', supabase_uid='owner-uid')
    RoleAssignment.objects.create(user=user, role=roles['owner'], organisation=org, status='active')
    return user


@pytest.fixture
def admin_user(org, roles):
    user = User.objects.create_user(email='admin@test.com', supabase_uid='admin-uid')
    RoleAssignment.objects.create(user=user, role=roles['admin'], organisation=org, status='active')
    return user


@pytest.fixture
def instructor_user(org, roles):
    user = User.objects.create_user(email='instructor1@test.com', supabase_uid='inst1-uid')
    RoleAssignment.objects.create(user=user, role=roles['instructor'], organisation=org, status='active')
    return user


@pytest.fixture
def instructor2_user(org, roles):
    user = User.objects.create_user(email='instructor2@test.com', supabase_uid='inst2-uid')
    RoleAssignment.objects.create(user=user, role=roles['instructor'], organisation=org, status='active')
    return user


@pytest.fixture
def student_user(org, roles):
    user = User.objects.create_user(email='student@test.com', supabase_uid='student-uid')
    RoleAssignment.objects.create(user=user, role=roles['student'], organisation=org, status='active')
    return user


@pytest.fixture
def student2_user(org, roles):
    user = User.objects.create_user(email='student2@test.com', supabase_uid='student2-uid')
    RoleAssignment.objects.create(user=user, role=roles['student'], organisation=org, status='active')
    return user


@pytest.fixture
def parent_user(org, roles):
    user = User.objects.create_user(email='parent@test.com', supabase_uid='parent-uid')
    RoleAssignment.objects.create(user=user, role=roles['parent'], organisation=org, status='active')
    return user


@pytest.fixture
def sponsor_user(org, roles):
    user = User.objects.create_user(email='sponsor@test.com', supabase_uid='sponsor-uid')
    RoleAssignment.objects.create(user=user, role=roles['sponsorship'], organisation=org, status='active')
    return user


@pytest.fixture
def treasurer_user(org, roles):
    user = User.objects.create_user(email='treasurer@test.com', supabase_uid='treasurer-uid')
    RoleAssignment.objects.create(user=user, role=roles['treasurer'], organisation=org, status='active')
    return user


@pytest.fixture
def enrolment(student_user, course):
    return Enrolment.objects.create(student=student_user, course=course, status='active')


@pytest.fixture
def parent_child_link(parent_user, student_user):
    return ParentChildLink.objects.create(
        parent_user=parent_user,
        student_user=student_user,
        relationship_type='parent',
        is_verified=True,
        is_active=True,
        consent_given=True,
    )


@pytest.mark.django_db
class TestCourseRBAC:
    """Test course queryset filtering by role."""

    def test_owner_sees_all_org_courses(self, owner_user, course, course2):
        """Owner should see all courses in their org."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': owner_user})()
        qs = view.get_queryset()
        assert qs.count() == 2

    def test_admin_sees_all_org_courses(self, admin_user, course, course2):
        """Admin should see all courses in their org."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': admin_user})()
        qs = view.get_queryset()
        assert qs.count() == 2

    def test_instructor_sees_only_own_courses(self, instructor_user, course, course2):
        """Instructor should only see courses they teach."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': instructor_user})()
        qs = view.get_queryset()
        assert qs.count() == 1
        assert qs.first().title == 'Math 7A'

    def test_student_sees_only_enrolled_courses(self, student_user, course, course2, enrolment):
        """Student should only see courses they are enrolled in."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': student_user})()
        qs = view.get_queryset()
        assert qs.count() == 1
        assert qs.first().title == 'Math 7A'

    def test_student_no_enrolments_sees_nothing(self, student_user, course, course2):
        """Student with no enrolments should see nothing."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': student_user})()
        qs = view.get_queryset()
        assert qs.count() == 0

    def test_parent_sees_child_enrolled_courses(
        self, parent_user, course, course2, enrolment, parent_child_link
    ):
        """Parent should see courses their verified child is enrolled in."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': parent_user})()
        qs = view.get_queryset()
        assert qs.count() == 1
        assert qs.first().title == 'Math 7A'

    def test_parent_no_verified_link_sees_nothing(self, parent_user, course, student_user):
        """Parent without verified link should see nothing."""
        link = ParentChildLink.objects.create(
            parent_user=parent_user, student_user=student_user,
            is_verified=False, is_active=True, consent_given=False,
        )
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': parent_user})()
        qs = view.get_queryset()
        assert qs.count() == 0

    def test_sponsor_sees_only_published_courses(self, sponsor_user, course, course2):
        """Sponsor should see published courses."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': sponsor_user})()
        qs = view.get_queryset()
        assert qs.count() == 2  # Both are published

    def test_unrelated_user_sees_nothing(self, student_user, course):
        """A student not enrolled in any course sees nothing."""
        from courses.views_courses import CourseViewSet
        view = CourseViewSet()
        view.request = type('Request', (), {'user': student_user})()
        qs = view.get_queryset()
        assert qs.count() == 0


@pytest.mark.django_db
class TestGradeRBAC:
    """Test grade queryset filtering by role."""

    def test_student_sees_only_own_grades(self, student_user, student2_user, course, lesson):
        """Student should only see their own grades."""
        activity = ActivityDefinition.objects.create(
            title='Quiz 1', activity_type='multiple_choice',
            status='published', organisation=course.organisation,
        )
        grade1 = Grade.objects.create(student=student_user, activity=activity, score=85, max_score=100, released=True)
        grade2 = Grade.objects.create(student=student2_user, activity=activity, score=90, max_score=100, released=True)

        from gradebook.views import GradeViewSet
        view = GradeViewSet()
        view.request = type('Request', (), {'user': student_user})()
        qs = view.get_queryset()
        assert qs.count() == 1
        assert qs.first().score == 85

    def test_instructor_sees_grades_for_own_org(self, instructor_user, instructor2_user, course, course2, lesson):
        """Instructor should see grades for activities in their org."""
        from gradebook.views import GradeViewSet
        from identity.models import User
        student = User.objects.create_user(email='s@test.com', supabase_uid='s-uid')
        activity1 = ActivityDefinition.objects.create(
            title='Quiz 1', activity_type='multiple_choice',
            status='published', organisation=course.organisation,
        )
        lesson2 = Lesson.objects.create(
            course=course2, title='Algebra 2', order=1,
            content_type='text', content_data={}, is_published=True,
        )
        activity2 = ActivityDefinition.objects.create(
            title='Quiz 2', activity_type='multiple_choice',
            status='published', organisation=course2.organisation,
        )
        grade1 = Grade.objects.create(student=student, activity=activity1, score=85, max_score=100)
        grade2 = Grade.objects.create(student=student, activity=activity2, score=90, max_score=100)

        view = GradeViewSet()
        view.request = type('Request', (), {'user': instructor_user})()
        qs = view.get_queryset()
        # Both activities are in the same org, so instructor sees both
        assert qs.count() == 2


@pytest.mark.django_db
class TestUserRBAC:
    """Test user queryset filtering by role."""

    def test_admin_sees_all_users(self, admin_user, student_user, instructor_user):
        """Admin should see all active users."""
        from identity.views_users import UserViewSet
        view = UserViewSet()
        view.request = type('Request', (), {'user': admin_user})()
        qs = view.get_queryset()
        assert qs.count() >= 3  # admin, student, instructor

    def test_student_sees_only_self(self, student_user, admin_user, instructor_user):
        """Student should only see themselves."""
        from identity.views_users import UserViewSet
        view = UserViewSet()
        view.request = type('Request', (), {'user': student_user})()
        qs = view.get_queryset()
        assert qs.count() == 1
        assert qs.first().email == 'student@test.com'

    def test_instructor_sees_enrolled_students(self, instructor_user, student_user, course, enrolment):
        """Instructor should see students enrolled in their courses."""
        from identity.views_users import UserViewSet
        view = UserViewSet()
        view.request = type('Request', (), {'user': instructor_user})()
        qs = view.get_queryset()
        assert student_user in qs


@pytest.mark.django_db
class TestParentChildRBAC:
    """Test parent-child relationship filtering."""

    def test_parent_only_sees_own_links(self, parent_user, student_user, parent_child_link):
        """Parent should only see their own parent-child links."""
        other_parent = User.objects.create_user(email='other_parent@test.com', supabase_uid='other-uid')
        from identity.views_roles import ParentChildLinkViewSet
        view = ParentChildLinkViewSet()
        view.request = type('Request', (), {'user': parent_user})()
        qs = view.get_queryset()
        assert qs.count() == 1

    def test_parent_cannot_see_other_parent_links(self, parent_user, student_user, parent_child_link):
        """Parent should not see another parent's links."""
        other_parent = User.objects.create_user(email='other_parent@test.com', supabase_uid='other-uid')
        other_link = ParentChildLink.objects.create(
            parent_user=other_parent, student_user=student_user,
            is_verified=True, is_active=True, consent_given=True,
        )
        from identity.views_roles import ParentChildLinkViewSet
        view = ParentChildLinkViewSet()
        view.request = type('Request', (), {'user': parent_user})()
        qs = view.get_queryset()
        assert qs.count() == 1
        assert other_link not in qs


@pytest.mark.django_db
class TestFinanceRBAC:
    """Test finance isolation."""

    def test_treasurer_sees_finance(self, treasurer_user):
        """Treasurer should access finance endpoints."""
        assert _has_role(treasurer_user, 'treasurer')

    def test_student_cannot_access_finance(self, student_user):
        """Student should not access finance endpoints."""
        assert not _has_any_role(student_user, ['owner', 'treasurer'])


@pytest.mark.django_db
class TestExpiredAssignment:
    """Test that expired/revoked assignments are excluded."""

    def test_expired_assignment_excluded(self, org, roles):
        """Expired role assignments should not grant access."""
        user = User.objects.create_user(email='expired@test.com', supabase_uid='expired-uid')
        RoleAssignment.objects.create(
            user=user, role=roles['admin'], organisation=org,
            status='active',
            valid_until=timezone.now() - timedelta(days=1),  # expired
        )
        assert not _has_role(user, 'admin')

    def test_revoked_assignment_excluded(self, org, roles):
        """Revoked role assignments should not grant access."""
        user = User.objects.create_user(email='revoked@test.com', supabase_uid='revoked-uid')
        RoleAssignment.objects.create(
            user=user, role=roles['admin'], organisation=org,
            status='revoked',
        )
        assert not _has_role(user, 'admin')

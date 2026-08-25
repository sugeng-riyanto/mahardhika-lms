import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from identity.models import (
    User, Profile, Role, RoleAssignment, ParentChildLink,
    ThirdPartyGrant, Permission,
)
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles,
    is_parent_of, has_course_access,
)

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_create_user(self):
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            supabase_uid='test-uid',
        )
        assert user.email == 'test@example.com'
        assert user.supabase_uid == 'test-uid'
        assert user.is_active is True
        assert user.check_password('testpass123')

    def test_user_str(self):
        user = User.objects.create_user(
            email='test@example.com',
            supabase_uid='test-uid',
        )
        assert str(user) == 'test@example.com'

    def test_create_user_no_email_raises(self):
        with pytest.raises(ValueError):
            User.objects.create_user(email='', supabase_uid='test-uid')

    def test_unique_email(self):
        User.objects.create_user(
            email='test@example.com',
            supabase_uid='uid-1',
        )
        with pytest.raises(Exception):
            User.objects.create_user(
                email='test@example.com',
                supabase_uid='uid-2',
            )

    def test_unique_supabase_uid(self):
        User.objects.create_user(
            email='test1@example.com',
            supabase_uid='uid-1',
        )
        with pytest.raises(Exception):
            User.objects.create_user(
                email='test2@example.com',
                supabase_uid='uid-1',
            )


@pytest.mark.django_db
class TestRoleModel:
    def test_create_role(self):
        role = Role.objects.create(
            name='instructor',
            display_name='Instructor',
            description='Teaching role',
        )
        assert role.name == 'instructor'
        assert str(role) == 'Instructor'

    def test_unique_role_name(self):
        Role.objects.create(name='admin', display_name='Admin')
        with pytest.raises(Exception):
            Role.objects.create(name='admin', display_name='Admin Again')


@pytest.mark.django_db
class TestRoleAssignment:
    def test_create_assignment(self, organisation, roles, owner_user):
        assignment = RoleAssignment.objects.create(
            user=owner_user,
            role=roles['owner'],
            organisation=organisation,
            status='active',
        )
        assert assignment.is_valid

    def test_expired_assignment(self, organisation, roles, owner_user):
        assignment = RoleAssignment.objects.create(
            user=owner_user,
            role=roles['owner'],
            organisation=organisation,
            status='active',
            valid_until=timezone.now() - timedelta(days=1),
        )
        assert not assignment.is_valid

    def test_revoked_assignment(self, organisation, roles, owner_user):
        assignment = RoleAssignment.objects.create(
            user=owner_user,
            role=roles['owner'],
            organisation=organisation,
            status='revoked',
        )
        assert not assignment.is_valid

    def test_inactive_assignment(self, organisation, roles, owner_user):
        assignment = RoleAssignment.objects.create(
            user=owner_user,
            role=roles['owner'],
            organisation=organisation,
            status='expired',
        )
        assert not assignment.is_valid


@pytest.mark.django_db
class TestRBACPermissions:
    def test_has_role(self, organisation, roles, owner_user):
        assert _has_role(owner_user, 'owner')
        assert not _has_role(owner_user, 'admin')
        assert not _has_role(owner_user, 'student')

    def test_has_any_role(self, organisation, roles, owner_user):
        assert _has_any_role(owner_user, ['owner', 'admin'])
        assert not _has_any_role(owner_user, ['admin', 'student'])

    def test_get_user_roles(self, organisation, roles, owner_user):
        user_roles = get_user_roles(owner_user)
        assert 'owner' in user_roles
        assert 'admin' not in user_roles

    def test_get_user_roles_empty(self, db):
        user = User.objects.create_user(
            email='noroles@test.com',
            supabase_uid='no-roles-uid',
        )
        assert get_user_roles(user) == []


@pytest.mark.django_db
class TestParentChildLink:
    def test_is_parent_of(self, parent_user, student_user):
        assert is_parent_of(parent_user, str(student_user.id))

    def test_not_parent_of(self, student_user, owner_user):
        assert not is_parent_of(owner_user, str(student_user.id))

    def test_unverified_parent(self, organisation, roles, student_user):
        other_user = User.objects.create_user(
            email='unverified@test.com',
            supabase_uid='unverified-uid',
        )
        RoleAssignment.objects.create(
            user=other_user,
            role=roles['parent'],
            organisation=organisation,
            status='active',
        )
        ParentChildLink.objects.create(
            parent_user=other_user,
            student_user=student_user,
            is_verified=False,
            is_active=True,
            consent_given=False,
        )
        assert not is_parent_of(other_user, str(student_user.id))


@pytest.mark.django_db
class TestCrossChildAccess:
    """Security tests: parent A should not access child B."""

    def test_parent_cannot_access_other_student(self, organisation, roles):
        # Create two student-parent pairs
        student_a = User.objects.create_user(
            email='student-a@test.com',
            supabase_uid='student-a-uid',
        )
        student_b = User.objects.create_user(
            email='student-b@test.com',
            supabase_uid='student-b-uid',
        )
        parent_a = User.objects.create_user(
            email='parent-a@test.com',
            supabase_uid='parent-a-uid',
        )
        parent_b = User.objects.create_user(
            email='parent-b@test.com',
            supabase_uid='parent-b-uid',
        )

        # Link parent_a -> student_a only
        ParentChildLink.objects.create(
            parent_user=parent_a,
            student_user=student_a,
            is_verified=True,
            is_active=True,
            consent_given=True,
        )
        ParentChildLink.objects.create(
            parent_user=parent_b,
            student_user=student_b,
            is_verified=True,
            is_active=True,
            consent_given=True,
        )

        # parent_a should NOT see student_b
        assert is_parent_of(parent_a, str(student_b.id)) is False
        # parent_b should NOT see student_a
        assert is_parent_of(parent_b, str(student_a.id)) is False
        # Each parent SHOULD see their own child
        assert is_parent_of(parent_a, str(student_a.id)) is True
        assert is_parent_of(parent_b, str(student_b.id)) is True


@pytest.mark.django_db
class TestCourseAccess:
    def test_admin_has_course_access(self, admin_user):
        from uuid import uuid4
        assert has_course_access(admin_user, uuid4())

    def test_owner_has_course_access(self, owner_user):
        from uuid import uuid4
        assert has_course_access(owner_user, uuid4())

    def test_student_no_global_course_access(self, student_user):
        from uuid import uuid4
        assert not has_course_access(student_user, uuid4())

from rest_framework.permissions import BasePermission
from django.utils import timezone


class IsOwner(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'owner')


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'admin')


class IsTreasurer(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'treasurer')


class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'instructor')


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'student')


class IsParent(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'parent')


class IsSponsor(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_role(request.user, 'sponsorship')


class IsAdminOrOwner(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            _has_role(request.user, 'owner') or _has_role(request.user, 'admin')
        )


class IsInstructorOrAbove(BasePermission):
    """Allow instructors, admins, and owners."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_any_role(
            request.user, ['owner', 'admin', 'instructor']
        )


class IsFinanceRole(BasePermission):
    """Allow treasurer and owner for finance operations."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and _has_any_role(
            request.user, ['owner', 'treasurer']
        )


def _has_role(user, role_name: str) -> bool:
    """Check if user has a specific active role assignment."""
    from identity.models import RoleAssignment
    now = timezone.now()
    return RoleAssignment.objects.filter(
        user=user,
        role__name=role_name,
        status='active',
        valid_from__lte=now,
    ).exclude(
        valid_until__isnull=False,
        valid_until__lt=now,
    ).exists()


def _has_any_role(user, role_names: list) -> bool:
    """Check if user has any of the specified active role assignments."""
    from identity.models import RoleAssignment
    now = timezone.now()
    return RoleAssignment.objects.filter(
        user=user,
        role__name__in=role_names,
        status='active',
        valid_from__lte=now,
    ).exclude(
        valid_until__isnull=False,
        valid_until__lt=now,
    ).exists()


def get_user_roles(user) -> list:
    """Get list of active role names for a user."""
    from identity.models import RoleAssignment
    now = timezone.now()
    assignments = RoleAssignment.objects.filter(
        user=user,
        status='active',
        valid_from__lte=now,
    ).exclude(
        valid_until__isnull=False,
        valid_until__lt=now,
    ).select_related('role')
    return [a.role.name for a in assignments]


def get_user_organisation(user):
    """Get the primary organisation for a user."""
    from identity.models import RoleAssignment
    assignment = RoleAssignment.objects.filter(
        user=user,
        status='active',
    ).select_related('organisation').first()
    return assignment.organisation if assignment else None


def has_course_access(user, course_id, required_roles=None) -> bool:
    """Check if user has access to a specific course."""
    if required_roles is None:
        required_roles = ['owner', 'admin']

    # Check if user has a global/admin role
    if _has_any_role(user, required_roles):
        return True

    # Check course-level scope
    from identity.models import RoleAssignment
    now = timezone.now()
    return RoleAssignment.objects.filter(
        user=user,
        status='active',
        scope_type='course',
        scope_id=course_id,
        valid_from__lte=now,
    ).exclude(
        valid_until__isnull=False,
        valid_until__lt=now,
    ).exists()


def is_parent_of(user, student_id: str) -> bool:
    """Check if user is a verified parent of a student."""
    from identity.models import ParentChildLink
    return ParentChildLink.objects.filter(
        parent_user=user,
        student_user_id=student_id,
        is_verified=True,
        is_active=True,
        consent_given=True,
    ).exists()

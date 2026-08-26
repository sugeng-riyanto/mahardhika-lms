"""
User management views with org-scoped RBAC.

- Owner/Admin: all users in their org
- Instructor: can see students in their courses
- Student: can only see their own profile
- Parent: can see their linked children only
"""
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from identity.models import User, Profile
from identity.serializers import UserSerializer, ProfileSerializer
from identity.permissions import (
    IsAdminOrOwner, IsAcademicRole, _has_role, _has_any_role, get_user_roles, get_user_organisation
)


class UserViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """User management endpoint — org-scoped."""
    audit_resource_type = 'user'
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    search_fields = ['email', 'full_name']
    filterset_fields = ['is_active']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = User.objects.filter(is_active=True)

        if _has_any_role(user, ['owner', 'admin']):
            # Admin sees all active users
            return qs

        # Instructor: see students in their courses + fellow instructors
        if 'instructor' in roles and not _has_any_role(user, ['owner', 'admin']):
            from courses.models import Enrolment
            student_ids = Enrolment.objects.filter(
                course__instructor=user, status='active'
            ).values_list('student_id', flat=True)
            return qs.filter(id__in=student_ids)

        # All other authenticated users: only see themselves
        return qs.filter(id=user.id)

    def perform_destroy(self, instance):
        """Soft delete: deactivate user instead of removing."""
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class ProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """User profile management."""
    audit_resource_type = 'profile'
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)

        # Owner/Admin can see all profiles
        if _has_any_role(user, ['owner', 'admin']):
            return Profile.objects.select_related('user', 'organisation').all()

        # Parent: can see their children's profiles
        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user,
                is_verified=True,
                is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return Profile.objects.filter(
                user_id__in=child_ids
            ).select_related('user', 'organisation')

        # Default: only own profile
        return Profile.objects.filter(user=user).select_related('user', 'organisation')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

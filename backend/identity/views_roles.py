"""
Role management views with org-scoped RBAC filtering.

- Owner/Admin: all assignments in their org
- Parent: can see their own parent-child links
- Other roles: read-only access to roles list
"""
import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from identity.models import RoleAssignment, ParentChildLink, ThirdPartyGrant, Role
from identity.serializers import (
    RoleAssignmentSerializer, RoleAssignmentCreateSerializer,
    ParentChildLinkSerializer, ThirdPartyGrantSerializer, RoleSerializer,
)
from core.audit_mixin import AuditLogMixin
from identity.permissions import (
    IsAdminOrOwner, IsConsentRole, _has_role, _has_any_role, get_user_roles, get_user_organisation
)

logger = logging.getLogger('audit')


class RoleAssignmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Manage role assignments — org-scoped."""
    audit_resource_type = 'role_assignment'
    serializer_class = RoleAssignmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    filterset_fields = ['user', 'role', 'status', 'organisation']

    def get_queryset(self):
        org = get_user_organisation(self.request.user)
        qs = RoleAssignment.objects.select_related('role', 'user', 'organisation')
        if org:
            qs = qs.filter(organisation=org)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return RoleAssignmentCreateSerializer
        return RoleAssignmentSerializer

    def perform_create(self, serializer):
        org = get_user_organisation(self.request.user)
        if not org:
            raise PermissionDenied('No organisation context.')
        assignment = serializer.save(approver=self.request.user, organisation=org)
        logger.info(
            f'Role assigned: {assignment.user.email} -> {assignment.role.name} '
            f'by {self.request.user.email}'
        )

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke a role assignment."""
        assignment = self.get_object()
        assignment.status = 'revoked'
        assignment.save(update_fields=['status', 'updated_at'])
        logger.info(
            f'Role revoked: {assignment.user.email} -> {assignment.role.name} '
            f'by {request.user.email}'
        )
        return Response({'status': 'revoked'})

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Get current user's role assignments."""
        assignments = RoleAssignment.objects.filter(
            user=request.user, status='active'
        ).select_related('role')
        serializer = RoleAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)


class ParentChildLinkViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Manage parent-child relationships — org-scoped."""
    audit_resource_type = 'parent_child_link'
    serializer_class = ParentChildLinkSerializer
    permission_classes = [IsAuthenticated, IsConsentRole]
    filterset_fields = ['parent_user', 'student_user', 'is_verified', 'is_active']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        qs = ParentChildLink.objects.select_related('parent_user', 'student_user')

        # Owner/Admin: all links in their org
        if _has_any_role(user, ['owner', 'admin']):
            return qs

        # Parent: only their own links
        if 'parent' in roles:
            return qs.filter(parent_user=user)

        # Instructor: links for students in their courses
        if 'instructor' in roles:
            from courses.models import Enrolment
            student_ids = Enrolment.objects.filter(
                course__instructor=user, status='active'
            ).values_list('student_id', flat=True)
            return qs.filter(student_user_id__in=student_ids)

        return qs.none()

    def perform_create(self, serializer):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can create parent-child links.')
        link = serializer.save()
        logger.info(
            f'Parent-child link created: {link.parent_user.email} -> {link.student_user.email} '
            f'by {self.request.user.email}'
        )

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify a parent-child link."""
        if not _has_any_role(request.user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can verify parent-child links.')
        link = self.get_object()
        link.is_verified = True
        link.save(update_fields=['is_verified', 'updated_at'])
        logger.info(f'Parent-child link verified: {link.id} by {request.user.email}')
        return Response({'status': 'verified'})

    @action(detail=True, methods=['post'])
    def consent(self, request, pk=None):
        """Grant consent on a parent-child link."""
        from django.utils import timezone
        link = self.get_object()
        # Only the parent or admin can grant consent
        if link.parent_user_id != request.user.id and not _has_any_role(request.user, ['owner', 'admin']):
            raise PermissionDenied('Only the parent or admin can grant consent.')
        link.consent_given = True
        link.consent_date = timezone.now()
        link.save(update_fields=['consent_given', 'consent_date', 'updated_at'])
        logger.info(f'Consent granted: {link.id} by {request.user.email}')
        return Response({'status': 'consent_granted'})

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can delete parent-child links.')
        instance.delete()


class ThirdPartyGrantViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Manage third-party access grants — admin/owner only, org-scoped."""
    audit_resource_type = 'third_party_grant'
    serializer_class = ThirdPartyGrantSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    filterset_fields = ['third_party_user', 'organisation', 'is_active']

    def get_queryset(self):
        org = get_user_organisation(self.request.user)
        qs = ThirdPartyGrant.objects.select_related(
            'third_party_user', 'organisation', 'granted_by'
        )
        if org:
            qs = qs.filter(organisation=org)
        return qs

    def perform_create(self, serializer):
        org = get_user_organisation(self.request.user)
        if not org:
            raise PermissionDenied('No organisation context.')
        grant = serializer.save(granted_by=self.request.user, organisation=org)
        logger.info(
            f'Third-party grant created: {grant.third_party_user.email} '
            f'purpose={grant.purpose} by {self.request.user.email}'
        )

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke a third-party grant."""
        grant = self.get_object()
        grant.is_active = False
        grant.save(update_fields=['is_active', 'updated_at'])
        logger.info(
            f'Third-party grant revoked: {grant.id} by {request.user.email}'
        )
        return Response({'status': 'revoked'})


class RoleListView(viewsets.ReadOnlyModelViewSet):
    """List available roles — readable by all authenticated users."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

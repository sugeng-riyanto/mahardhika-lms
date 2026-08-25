"""
Programme management with org-scoped RBAC.

- Owner/Admin: full CRUD on programmes in their org
- Instructor/Student/Parent: read-only on programmes in their org
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from courses.models import Programme
from courses.serializers import ProgrammeSerializer
from identity.permissions import (
    _has_any_role, get_user_organisation,
)


class ProgrammeViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Programme management -- org-scoped, read for all, write for admin/owner."""
    audit_resource_type = 'programme'
    serializer_class = ProgrammeSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'slug']
    filterset_fields = ['level', 'is_active', 'organisation']

    def get_queryset(self):
        org = get_user_organisation(self.request.user)
        qs = Programme.objects.all()
        if org:
            qs = qs.filter(organisation=org)
        return qs

    def _check_write_permission(self):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can modify programmes.')

    def perform_create(self, serializer):
        self._check_write_permission()
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._check_write_permission()
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._check_write_permission()
        super().perform_destroy(instance)

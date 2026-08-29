from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from organisations.models import Organisation
from organisations.serializers import OrganisationSerializer
from identity.permissions import IsAdminOrOwner
from core.audit_mixin import AuditLogMixin


class OrganisationViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Organisation management.
    RBAC: Only owner/admin can CRUD organisations.
    """
    audit_resource_type = 'organisation'
    queryset = Organisation.objects.all()
    serializer_class = OrganisationSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    search_fields = ['name', 'slug']
    filterset_fields = ['is_active', 'type']

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from audit.models import AuditEvent
from audit.serializers import AuditEventSerializer
from identity.permissions import IsAdminOrOwner


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view of audit events."""
    queryset = AuditEvent.objects.all()
    serializer_class = AuditEventSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    filterset_fields = ['action', 'resource_type', 'actor_id']
    search_fields = ['actor_email', 'action', 'resource_type']

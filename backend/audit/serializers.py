from rest_framework import serializers
from audit.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            'id', 'actor_id', 'actor_email', 'action', 'resource_type',
            'resource_id', 'scope', 'details', 'ip_address',
            'correlation_id', 'created_at',
        ]
        read_only_fields = fields

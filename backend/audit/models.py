import uuid
from django.db import models
from core.models import TimestampedModel


class AuditEvent(TimestampedModel):
    """Immutable audit event log."""
    actor_id = models.UUIDField(db_index=True)
    actor_email = models.EmailField()
    action = models.CharField(max_length=100, db_index=True)
    resource_type = models.CharField(max_length=100, db_index=True)
    resource_id = models.UUIDField(null=True, blank=True)
    scope = models.CharField(max_length=255, blank=True, default='')
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default='')
    correlation_id = models.UUIDField(default=uuid.uuid4, db_index=True)

    class Meta:
        db_table = 'audit_events'
        ordering = ['-created_at']
        # Audit events are immutable - no update
        indexes = [
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['actor_id', 'created_at']),
        ]

    def __str__(self):
        return f'{self.actor_email} {self.action} {self.resource_type}'

    def save(self, *args, **kwargs):
        # Prevent updates to existing audit events (allow first insert)
        if not self._state.adding and self.pk:
            raise ValueError('Audit events are immutable')
        super().save(*args, **kwargs)

    @classmethod
    def log(cls, actor_id, actor_email, action, resource_type,
            resource_id=None, scope='', details=None, ip_address=None,
            user_agent='', correlation_id=None):
        """Create an audit event."""
        kwargs = {
            'actor_id': actor_id,
            'actor_email': actor_email,
            'action': action,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'scope': scope,
            'details': details or {},
            'ip_address': ip_address,
            'user_agent': user_agent,
        }
        if correlation_id:
            kwargs['correlation_id'] = correlation_id
        return cls.objects.create(**kwargs)

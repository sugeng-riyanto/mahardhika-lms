"""
Audit logging mixin for Django REST Framework ViewSets.

Automatically creates AuditEvent records for all write operations:
- CREATE: logs the new resource with its data
- UPDATE: logs changed fields with before/after values
- DELETE: logs the deletion

Usage in any ViewSet:
    from core.audit_mixin import AuditLogMixin

    class MyViewSet(AuditLogMixin, viewsets.ModelViewSet):
        audit_resource_type = 'course'  # resource type name
        ...

The mixin extracts actor info from request.user, captures IP/user_agent,
and uses the AuditEvent.log() class method for immutable audit entries.
"""
import uuid
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('audit')


class AuditLogMixin:
    """
    Mixin that automatically logs audit events for create, update, delete.

    Override these class attributes to customize behavior:
        audit_resource_type: str - the resource type name (e.g., 'course')
        audit_scope: str - optional scope prefix (e.g., 'api.v1')
        audit_exclude_fields: set - fields to exclude from change tracking
        audit_log_create: bool - whether to log creates (default True)
        audit_log_update: bool - whether to log updates (default True)
        audit_log_delete: bool - whether to log deletes (default True)
    """

    audit_resource_type: str = 'unknown'
    audit_scope: str = ''
    audit_exclude_fields: set = {'created_at', 'updated_at', 'id'}
    audit_log_create: bool = True
    audit_log_update: bool = True
    audit_log_delete: bool = True

    def perform_create(self, serializer):
        super().perform_create(serializer)
        if self.audit_log_create:
            instance = serializer.instance
            self._log_event(
                action='create',
                resource_id=str(instance.pk) if instance.pk else None,
                details=self._get_instance_data(instance),
            )

    def perform_update(self, serializer):
        # Capture changes before update
        old_data = {}
        if self.audit_log_update:
            old_data = self._get_instance_data(serializer.instance)

        super().perform_update(serializer)

        if self.audit_log_update:
            instance = serializer.instance
            new_data = self._get_instance_data(instance)
            changed_fields = {
                k: {'old': old_data.get(k), 'new': new_data.get(k)}
                for k in new_data
                if k not in self.audit_exclude_fields and old_data.get(k) != new_data.get(k)
            }
            if changed_fields:
                self._log_event(
                    action='update',
                    resource_id=str(instance.pk),
                    details={'changed_fields': changed_fields},
                )

    def perform_destroy(self, instance):
        if self.audit_log_delete:
            resource_id = str(instance.pk)
            instance_data = self._get_instance_data(instance)
            # Store data before deletion
            self._log_event(
                action='delete',
                resource_id=resource_id,
                details={'deleted_data': instance_data},
            )
        super().perform_destroy(instance)

    def _log_event(self, action: str, resource_id: str = None,
                   details: dict = None):
        """Create an audit event."""
        from audit.models import AuditEvent
        from identity.permissions import get_user_roles

        request = self.request
        user = request.user if hasattr(request, 'user') else None

        if not user or not user.is_authenticated:
            return

        # Get actor info
        actor_id = user.id
        actor_email = user.email

        # Get request metadata
        ip_address = self._get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500] if hasattr(request, 'META') else ''

        # Build scope
        scope = self.audit_scope or self.audit_resource_type

        # Add role info to details
        if details is None:
            details = {}
        try:
            roles = get_user_roles(user)
            details['actor_roles'] = roles
        except Exception:
            pass

        try:
            AuditEvent.log(
                actor_id=actor_id,
                actor_email=actor_email,
                action=f'{self.audit_resource_type}.{action}',
                resource_type=self.audit_resource_type,
                resource_id=resource_id,
                scope=scope,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception as e:
            # Audit logging should never break the request
            logger.error(f'Audit log failed: {e}')

    def _get_instance_data(self, instance) -> dict:
        """Extract serializable data from a model instance."""
        if not instance or not instance.pk:
            return {}

        data = {'id': str(instance.pk)}

        # Get field values from the model
        for field in instance._meta.fields:
            field_name = field.name
            if field_name in self.audit_exclude_fields:
                continue
            try:
                value = getattr(instance, field_name)
                # Convert non-serializable types
                if hasattr(value, 'isoformat'):  # datetime/date
                    data[field_name] = value.isoformat()
                elif hasattr(value, 'hex'):  # UUID
                    data[field_name] = str(value)
                elif hasattr(value, 'pk'):  # ForeignKey object
                    data[field_name] = str(value.pk)
                elif isinstance(value, (str, int, float, bool, type(None))):
                    data[field_name] = value
                else:
                    data[field_name] = str(value)
            except Exception:
                pass

        # Add string representation if available
        try:
            data['_str'] = str(instance)
        except Exception:
            pass

        return data

    def _get_client_ip(self, request) -> str:
        """Extract client IP from request, handling proxies."""
        if not request or not hasattr(request, 'META'):
            return ''

        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()

        return request.META.get('REMOTE_ADDR', '')

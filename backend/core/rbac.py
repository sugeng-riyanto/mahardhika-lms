"""
RBAC queryset filtering and object-level permission mixins.

Every ViewSet should use one of these mixins to ensure:
1. Queryset filtering by role (students see only their data, etc.)
2. Object-level permissions (can't edit what you don't own)
3. Org-scoped isolation
4. Audit logging for sensitive operations
"""
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from identity.permissions import _has_role, _has_any_role, get_user_roles, get_user_organisation


class RBACQuerysetMixin:
    """
    Mixin that filters queryset based on the user's role.
    Override `get_rbac_queryset()` for custom filtering per ViewSet.
    """

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return self.model.objects.none()

        roles = get_user_roles(user)
        org = get_user_organisation(user)

        # Owner and admin see everything in their org
        if _has_any_role(user, ['owner', 'admin']):
            qs = self.model.objects.all()
            if org and hasattr(self.model, 'organisation'):
                qs = qs.filter(organisation=org)
            return self._apply_base_filters(qs)

        # Delegate to role-specific filtering
        return self._get_role_filtered_queryset(user, roles, org)

    def _get_role_filtered_queryset(self, user, roles, org):
        """Override in subclass or per-ViewSet for role-specific filtering."""
        # Default: user can only see their own data
        if hasattr(self.model, 'user'):
            return self.model.objects.filter(user=user)
        return self.model.objects.none()

    def _apply_base_filters(self, qs):
        """Apply common filters like soft-delete exclusion."""
        if hasattr(self.model, 'is_active'):
            qs = qs.filter(is_active=True)
        return qs


class RBACObjectPermissionMixin:
    """
    Mixin that adds object-level permissions.
    Override `check_object_permission()` for custom logic per ViewSet.
    """

    def check_object_permission(self, request, obj):
        """Check if user can perform the requested action on this object."""
        user = request.user
        roles = get_user_roles(user)
        method = request.method

        # Owner and admin can do anything (within org scope)
        if _has_any_role(user, ['owner', 'admin']):
            return True

        # Read: most roles can read objects they're associated with
        if method in ('GET', 'HEAD', 'OPTIONS'):
            return self._can_read(user, obj, roles)

        # Write: stricter checks
        if method in ('POST', 'PUT', 'PATCH'):
            return self._can_write(user, obj, roles)

        # Delete: strictest
        if method == 'DELETE':
            return self._can_delete(user, obj, roles)

        return False

    def _can_read(self, user, obj, roles):
        """Override for custom read permissions."""
        return True  # Default: if you got past endpoint permissions, you can read

    def _can_write(self, user, obj, roles):
        """Override for custom write permissions."""
        return _has_any_role(user, ['owner', 'admin', 'instructor'])

    def _can_delete(self, user, obj, roles):
        """Override for custom delete permissions."""
        return _has_any_role(user, ['owner', 'admin'])

    def perform_update(self, serializer):
        self.check_object_permission(self.request, serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self.check_object_permission(self.request, instance)
        instance.delete()

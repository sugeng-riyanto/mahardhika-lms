import logging
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from identity.models import Profile, User
from identity.serializers import ProfileSerializer, UserSerializer, RoleAssignmentSerializer
from identity.permissions import get_user_roles, get_user_organisation
from core.audit_mixin import AuditLogMixin

logger = logging.getLogger('audit')


class AuthMeView(APIView):
    """Return current authenticated user info including roles and organisation."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = get_user_roles(user)
        organisation = get_user_organisation(user)

        # Get latest active role assignments
        role_assignments = RoleAssignmentSerializer(
            user.role_assignments.filter(status='active').select_related('role')[:10],
            many=True,
        ).data

        return Response({
            'user': UserSerializer(user).data,
            'roles': roles,
            'organisation_id': organisation.id if organisation else None,
            'role_assignments': role_assignments,
        })


class AuthTokenVerifyView(APIView):
    """Verify if a token is still valid."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'valid': True, 'user_id': str(request.user.id)})


class ProfileMeView(AuditLogMixin, APIView):
    """
    View and update the current user's own profile.

    Every authenticated user may manage their own profile (name, phone,
    date of birth, avatar URL, preferred language). The profile row is
    created on first read if it does not exist yet, and full_name is kept
    in sync on the User account as well as the Profile.
    """
    permission_classes = [IsAuthenticated]
    audit_resource_type = 'profile'

    def get(self, request):
        profile = self._get_or_create_profile(request.user)
        return Response(ProfileSerializer(profile).data)

    def put(self, request):
        user = request.user
        profile = self._get_or_create_profile(user)

        data = request.data or {}
        allowed = {'full_name', 'phone', 'date_of_birth', 'avatar_url', 'preferred_language'}

        # Sync full_name onto the account so the sidebar/auth-me stay consistent
        full_name = (data.get('full_name') or '').strip()
        if full_name and full_name != user.full_name:
            user.full_name = full_name[:255]
            user.save(update_fields=['full_name', 'updated_at'])

        update_fields = []
        for field in allowed:
            if field not in data:
                continue
            value = data.get(field)
            if field == 'date_of_birth' and value in ('', None):
                value = None
            elif value is not None:
                value = str(value)[:500] if field == 'avatar_url' else str(value)[:255]
            if getattr(profile, field) != value:
                setattr(profile, field, value)
                update_fields.append(field)

        if update_fields:
            try:
                profile.full_clean(exclude=['user', 'organisation'])
            except DjangoValidationError as e:
                return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
            profile.save(update_fields=update_fields + ['updated_at'])
            self._log_event(
                action='update',
                resource_id=str(profile.pk),
                details={'changed_fields': update_fields},
            )

        return Response(ProfileSerializer(profile).data)

    def _get_or_create_profile(self, user: User) -> Profile:
        profile, created = Profile.objects.get_or_create(
            user=user,
            defaults={
                'organisation': get_user_organisation(user),
                'full_name': user.full_name,
            },
        )
        if created:
            self._log_event(
                action='create',
                resource_id=str(profile.pk),
                details={'fields': ['organisation', 'full_name']},
            )
        return profile


class ChangePasswordView(AuditLogMixin, APIView):
    """
    Change the current user's password.

    On a Supabase-hosted deployment the real password lives in Supabase
    Auth, so the frontend also calls supabase.auth.updateUser() there. This
    endpoint keeps the Django-side password in sync (used by seeded/dev
    accounts and anything authenticating against the Django user store).
    """
    permission_classes = [IsAuthenticated]
    audit_resource_type = 'user'

    def post(self, request):
        user = request.user
        data = request.data or {}

        current_password = data.get('current_password')
        new_password = data.get('new_password')

        if not new_password or len(new_password) < 8:
            return Response(
                {'detail': 'New password must be at least 8 characters long.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_password == current_password:
            return Response(
                {'detail': 'New password must be different from the current password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.has_usable_password():
            if not current_password or not user.check_password(current_password):
                return Response(
                    {'detail': 'Current password is incorrect.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user.set_password(new_password)
        user.save(update_fields=['password', 'updated_at'])
        self._log_event(
            action='change_password',
            resource_id=str(user.pk),
            details={'actor_roles': get_user_roles(user)},
        )
        return Response({'detail': 'Password updated successfully.'})


class MfaToggleView(AuditLogMixin, APIView):
    """
    Enable or disable MFA for the current user.

    The flag gates the account until a real TOTP/authenticator flow lands;
    it mirrors the mfa_enabled field already exposed on the User resource.
    """
    permission_classes = [IsAuthenticated]
    audit_resource_type = 'user'

    def post(self, request):
        user = request.user
        data = request.data or {}
        enabled = data.get('enabled')
        if not isinstance(enabled, bool):
            return Response(
                {'detail': 'enabled must be a boolean.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if enabled == user.mfa_enabled:
            return Response({'mfa_enabled': user.mfa_enabled})

        user.mfa_enabled = enabled
        user.save(update_fields=['mfa_enabled', 'updated_at'])
        self._log_event(
            action='mfa_toggle' if enabled else 'mfa_disable',
            resource_id=str(user.pk),
            details={'actor_roles': get_user_roles(user)},
        )
        return Response({'mfa_enabled': user.mfa_enabled})


class DeleteAccountView(AuditLogMixin, APIView):
    """
    Deactivate the current user's account.

    Requires the account email in the body as confirmation. The account is
    soft-deleted (is_active=False) so the user can no longer authenticate
    against the API; the frontend clears the local session afterwards.
    """
    permission_classes = [IsAuthenticated]
    audit_resource_type = 'user'

    def post(self, request):
        user = request.user
        data = request.data or {}
        confirm = str(data.get('confirm', '')).strip().lower()

        try:
            validate_email(confirm)
        except DjangoValidationError:
            return Response(
                {'detail': 'Type your account email to confirm deletion.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if confirm != user.email.lower():
            return Response(
                {'detail': 'Email does not match the signed-in account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])
        self._log_event(
            action='delete_account',
            resource_id=str(user.pk),
            details={'actor_roles': get_user_roles(user)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

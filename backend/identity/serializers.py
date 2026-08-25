from rest_framework import serializers
from identity.models import (
    User, Profile, Role, Permission, RoleAssignment,
    ParentChildLink, ThirdPartyGrant, RolePermission,
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'is_active', 'mfa_enabled', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'user', 'user_email', 'organisation', 'full_name', 'phone',
            'date_of_birth', 'avatar_url', 'preferred_language', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'display_name', 'description', 'created_at']


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'name', 'resource', 'action', 'description', 'created_at']


class RoleAssignmentSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_display = serializers.CharField(source='role.display_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = RoleAssignment
        fields = [
            'id', 'user', 'user_email', 'role', 'role_name', 'role_display',
            'organisation', 'scope_type', 'scope_id', 'status',
            'valid_from', 'valid_until', 'approver', 'reason',
            'is_valid', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RoleAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoleAssignment
        fields = ['user', 'role', 'organisation', 'scope_type', 'scope_id', 'reason']


class ParentChildLinkSerializer(serializers.ModelSerializer):
    parent_email = serializers.CharField(source='parent_user.email', read_only=True)
    student_email = serializers.CharField(source='student_user.email', read_only=True)

    class Meta:
        model = ParentChildLink
        fields = [
            'id', 'parent_user', 'parent_email', 'student_user', 'student_email',
            'relationship_type', 'is_verified', 'is_active',
            'consent_given', 'consent_date', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ThirdPartyGrantSerializer(serializers.ModelSerializer):
    third_party_email = serializers.CharField(source='third_party_user.email', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = ThirdPartyGrant
        fields = [
            'id', 'third_party_user', 'third_party_email', 'organisation',
            'purpose', 'scope_type', 'scope_id', 'is_active',
            'valid_from', 'valid_until', 'granted_by',
            'is_valid', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AuthMeSerializer(serializers.Serializer):
    """Serializer for /auth/me/ endpoint response."""
    user = UserSerializer()
    profile = ProfileSerializer(allow_null=True)
    roles = serializers.ListField(child=serializers.CharField())
    organisation_id = serializers.UUIDField(allow_null=True)

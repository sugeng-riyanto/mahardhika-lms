"""
Notification preferences — per-user settings for channels, quiet hours, and categories.
"""
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from notifications.models import NotificationPreference


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = NotificationPreference
        fields = [
            'id', 'user', 'user_email',
            'email_enabled', 'whatsapp_enabled', 'in_app_enabled',
            'quiet_hours_start', 'quiet_hours_end',
            'max_emails_per_hour', 'max_whatsapp_per_hour',
            'category_preferences',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'user_email', 'created_at', 'updated_at']


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def notification_preferences(request):
    """
    GET: Get current user's notification preferences (creates defaults if not exist).
    PUT/PATCH: Update current user's notification preferences.
    """
    pref, created = NotificationPreference.objects.get_or_create(
        user=request.user,
        defaults={
            'email_enabled': True,
            'whatsapp_enabled': False,
            'in_app_enabled': True,
            'max_emails_per_hour': 10,
            'max_whatsapp_per_hour': 5,
            'category_preferences': {},
        },
    )

    if request.method == 'GET':
        return Response(NotificationPreferenceSerializer(pref).data)

    # PUT or PATCH
    partial = request.method == 'PATCH'
    serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)

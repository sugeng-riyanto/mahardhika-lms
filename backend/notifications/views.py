"""
Notifications — users see only their own notifications.

- All authenticated users: only their own notifications, mark as read, unread count
- Admin/Owner: can create notifications for others
"""
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import api_view, permission_classes as perm, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from notifications.models import Notification
from identity.permissions import _has_any_role, get_user_organisation


class NotificationSerializer(serializers.ModelSerializer):
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)

    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'recipient', 'read_at']


class NotificationViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Notification management — user-scoped.
    RBAC: All authenticated users can read their own notifications.
    Only admin/owner can create/delete notifications for others.
    """
    audit_resource_type = 'notification'
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]  # User-scoped: get_queryset filters by recipient

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(recipient=user)

        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            qs = qs.filter(is_read=is_read.lower() == 'true')

        # Filter by channel
        channel = self.request.query_params.get('channel')
        if channel:
            qs = qs.filter(channel=channel)

        return qs

    def perform_create(self, serializer):
        """Only admins/owners can create notifications for others."""
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can create notifications.')
        serializer.save()

    def perform_update(self, serializer):
        """Users can update their own notifications (mark as read)."""
        serializer.save()

    def perform_destroy(self, instance):
        """Only admins/owners can delete notifications."""
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can delete notifications.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at', 'updated_at'])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all unread notifications as read."""
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False,
        ).update(is_read=True, read_at=timezone.now())
        return Response({'marked_read': updated})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = Notification.objects.filter(
            recipient=request.user, is_read=False,
        ).count()
        return Response({'count': count})


@api_view(['POST'])
@perm([IsAuthenticated])
def create_notification_for_user(request):
    """Admin endpoint to send a notification to a specific user."""
    if not _has_any_role(request.user, ['owner', 'admin']):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Only admins can send notifications.')

    recipient_id = request.data.get('recipient')
    title = request.data.get('title', '')
    message = request.data.get('message', '')
    channel = request.data.get('channel', 'in_app')
    metadata = request.data.get('metadata', {})

    if not recipient_id or not title or not message:
        return Response(
            {'detail': 'recipient, title, and message are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from identity.models import User
    try:
        recipient = User.objects.get(id=recipient_id)
    except User.DoesNotExist:
        return Response({'detail': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Use the dispatcher to send across all channels
    from notifications.dispatcher import dispatch_notification
    channels = [channel]
    # If channel is in_app, also try email if recipient has email
    if channel == 'in_app' and hasattr(recipient, 'email') and recipient.email:
        channels.append('email')

    results = dispatch_notification(
        recipient=recipient,
        title=title,
        message=message,
        channels=channels,
        metadata=metadata,
    )

    # Return the in_app notification (most recent)
    notif = Notification.objects.filter(recipient=recipient).order_by('-created_at').first()
    return Response(
        {'notification': NotificationSerializer(notif).data if notif else None, 'dispatch_results': results},
        status=status.HTTP_201_CREATED,
    )

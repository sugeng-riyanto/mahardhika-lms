from django.db import models
from django.utils import timezone
from core.models import TimestampedModel


class Notification(TimestampedModel):
    """User notification."""
    CHANNEL_CHOICES = [
        ('in_app', 'In App'),
        ('email', 'Email'),
        ('whatsapp', 'WhatsApp'),
    ]

    recipient = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='notifications',
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='in_app')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} -> {self.recipient.email}'


class NotificationPreference(TimestampedModel):
    """
    Per-user notification preferences.
    Controls which channels are enabled, quiet hours, and frequency limits.
    """
    user = models.OneToOneField(
        'identity.User', on_delete=models.CASCADE, related_name='notification_preference',
    )

    # Channel toggles
    email_enabled = models.BooleanField(default=True)
    whatsapp_enabled = models.BooleanField(default=False)
    in_app_enabled = models.BooleanField(default=True)

    # Quiet hours (UTC)
    quiet_hours_start = models.TimeField(null=True, blank=True, help_text='Start of quiet hours (UTC)')
    quiet_hours_end = models.TimeField(null=True, blank=True, help_text='End of quiet hours (UTC)')

    # Frequency limits (per hour)
    max_emails_per_hour = models.PositiveIntegerField(default=10)
    max_whatsapp_per_hour = models.PositiveIntegerField(default=5)

    # Category preferences (JSON map of category -> enabled)
    category_preferences = models.JSONField(default=dict, blank=True, help_text='{"grade_released": true, "assignment_due": true}')

    class Meta:
        db_table = 'notification_preferences'

    def __str__(self):
        return f'Preferences for {self.user.email}'

    def is_channel_enabled(self, channel: str) -> bool:
        """Check if a channel is enabled for this user."""
        if channel == 'in_app':
            return self.in_app_enabled
        elif channel == 'email':
            return self.email_enabled
        elif channel == 'whatsapp':
            return self.whatsapp_enabled
        return False

    def is_quiet_hours(self) -> bool:
        """Check if current time is within quiet hours."""
        if not self.quiet_hours_start or not self.quiet_hours_end:
            return False
        now = timezone.now().time()
        start = self.quiet_hours_start
        end = self.quiet_hours_end
        if start <= end:
            return start <= now <= end
        else:
            # Spans midnight
            return now >= start or now <= end

    def is_category_enabled(self, category: str) -> bool:
        """Check if a notification category is enabled."""
        return self.category_preferences.get(category, True)


class NotificationQueue(TimestampedModel):
    """
    Queued notification for async delivery.
    Supports retry, delivery status, and rate limiting.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
        ('cancelled', 'Cancelled'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    notification = models.ForeignKey(
        Notification, on_delete=models.CASCADE, related_name='queue_entries',
    )
    channel = models.CharField(max_length=20, choices=Notification.CHANNEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')

    # Delivery tracking
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=3)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    # Error tracking
    error_message = models.TextField(blank=True, default='')
    error_code = models.CharField(max_length=50, blank=True, default='')

    # Provider metadata
    provider_message_id = models.CharField(max_length=255, blank=True, default='')
    provider_response = models.JSONField(default=dict, blank=True)

    # Rate limiting
    rate_limit_key = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'notification_queue'
        ordering = ['-priority', 'created_at']
        indexes = [
            models.Index(fields=['status', 'channel', 'next_retry_at']),
        ]

    def __str__(self):
        return f'Queue: {self.notification.title} ({self.channel}) - {self.status}'

    def mark_sent(self, provider_message_id: str = '', provider_response: dict = None):
        """Mark as successfully sent."""
        self.status = 'sent'
        self.delivered_at = timezone.now()
        self.provider_message_id = provider_message_id
        if provider_response:
            self.provider_response = provider_response
        self.save(update_fields=[
            'status', 'delivered_at', 'provider_message_id', 'provider_response', 'updated_at',
        ])

    def mark_failed(self, error_message: str, error_code: str = ''):
        """Mark as failed and schedule retry if under max attempts."""
        self.attempts += 1
        self.last_attempt_at = timezone.now()
        self.error_message = error_message
        self.error_code = error_code

        if self.attempts < self.max_attempts:
            # Exponential backoff: 1min, 5min, 25min
            delay_minutes = 5 ** (self.attempts - 1)
            self.next_retry_at = timezone.now() + timezone.timedelta(minutes=delay_minutes)
            self.status = 'retrying'
        else:
            self.status = 'failed'

        self.save(update_fields=[
            'status', 'attempts', 'last_attempt_at', 'next_retry_at',
            'error_message', 'error_code', 'updated_at',
        ])

    def mark_processing(self):
        """Mark as currently being processed."""
        self.status = 'processing'
        self.last_attempt_at = timezone.now()
        self.save(update_fields=['status', 'last_attempt_at', 'updated_at'])

    def cancel(self):
        """Cancel the queue entry."""
        self.status = 'cancelled'
        self.save(update_fields=['status', 'updated_at'])


class NotificationDeliveryLog(TimestampedModel):
    """
    Immutable audit log for notification delivery attempts.
    """
    queue_entry = models.ForeignKey(
        NotificationQueue, on_delete=models.CASCADE, related_name='delivery_logs',
    )
    action = models.CharField(max_length=50)  # 'queued', 'processing', 'sent', 'failed', 'retrying'
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'notification_delivery_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} - {self.queue_entry}'

from django.db import models
from django.utils import timezone
from core.models import TimestampedModel


class ConsentRecord(TimestampedModel):
    """Data processing consent record — UU PDP compliant."""

    PURPOSE_CHOICES = [
        ('learning', 'Learning Data Processing'),
        ('analytics', 'Aggregate Analytics'),
        ('communication', 'Communication'),
        ('third_party', 'Third Party Sharing'),
        ('marketing', 'Marketing & Promotions'),
        ('child_data', 'Child Personal Data Processing'),
        ('safeguarding', 'Safeguarding & Welfare'),
    ]

    STATUS_CHOICES = [
        ('granted', 'Granted'),
        ('withdrawn', 'Withdrawn'),
        ('expired', 'Expired'),
        ('pending', 'Pending'),
    ]

    # The user whose data is being consented about
    # For children: this is the child's user ID, not the parent's
    user = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='consent_records',
    )
    # The user who gave/withdrew consent (may be parent/guardian)
    consented_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='consent_actions',
    )
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    granted = models.BooleanField(default=False)
    granted_at = models.DateTimeField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    withdrawal_reason = models.TextField(blank=True, default='')
    expires_at = models.DateTimeField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)

    # UU PDP specific fields
    data_categories = models.JSONField(default=list, blank=True,
        help_text='List of personal data categories covered by this consent')
    processing_purpose = models.TextField(blank=True, default='',
        help_text='Detailed description of how the data will be processed')
    third_parties = models.JSONField(default=list, blank=True,
        help_text='List of third parties who may receive the data')
    retention_period_days = models.PositiveIntegerField(null=True, blank=True,
        help_text='How long the data will be retained after consent withdrawal')
    lawful_basis = models.CharField(max_length=50, default='consent', blank=True,
        help_text='Legal basis under UU PDP (consent, contract, legal obligation, etc.)')

    class Meta:
        db_table = 'consent_records'
        unique_together = ['user', 'purpose']
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} - {self.purpose}: {self.status}'

    def withdraw(self, reason=''):
        """Withdraw consent — UU PDP Article 21 right to withdraw."""
        self.status = 'withdrawn'
        self.granted = False
        self.withdrawn_at = timezone.now()
        self.withdrawal_reason = reason
        self.save(update_fields=[
            'status', 'granted', 'withdrawn_at', 'withdrawal_reason', 'updated_at'
        ])

    def grant(self, consented_by_user=None):
        """Grant or re-grant consent."""
        self.status = 'granted'
        self.granted = True
        self.granted_at = timezone.now()
        self.withdrawn_at = None
        self.withdrawal_reason = ''
        self.consented_by = consented_by_user
        self.save(update_fields=[
            'status', 'granted', 'granted_at', 'withdrawn_at',
            'withdrawal_reason', 'consented_by', 'updated_at'
        ])

    @property
    def is_active(self):
        if self.status != 'granted':
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    @property
    def is_expired(self):
        return self.expires_at is not None and self.expires_at < timezone.now()


class ConsentAuditLog(TimestampedModel):
    """Immutable audit trail for consent changes — UU PDP Article 58."""

    ACTION_CHOICES = [
        ('granted', 'Consent Granted'),
        ('withdrawn', 'Consent Withdrawn'),
        ('modified', 'Consent Modified'),
        ('expired', 'Consent Expired'),
        ('accessed', 'Consent Record Accessed'),
        ('export_requested', 'Data Export Requested'),
        ('deletion_requested', 'Data Deletion Requested'),
    ]

    consent = models.ForeignKey(
        ConsentRecord, on_delete=models.CASCADE, related_name='audit_logs',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True,
        related_name='consent_audit_actions',
    )
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'consent_audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} on consent {self.consent_id} by {self.performed_by}'


class DataExportRequest(TimestampedModel):
    """Track data export requests — UU PDP Article 26 right to data portability."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    FORMAT_CHOICES = [
        ('json', 'JSON'),
        ('csv', 'CSV'),
        ('pdf', 'PDF'),
    ]

    user = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='data_export_requests',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='json')
    data_categories = models.JSONField(default=list, blank=True)
    download_url = models.URLField(max_length=500, blank=True, default='')
    expires_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'data_export_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'Export request by {self.user.email} - {self.status}'


class DataDeletionRequest(TimestampedModel):
    """Track data deletion requests — UU PDP Article 26 right to erasure."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('denied', 'Denied'),
        ('partial', 'Partially Completed'),
    ]

    user = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='data_deletion_requests',
    )
    requested_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deletion_requests_filed',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    data_categories = models.JSONField(default=list, blank=True,
        help_text='Which categories of data to delete')
    reason = models.TextField(blank=True, default='')
    denial_reason = models.TextField(blank=True, default='')
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deletion_requests_processed',
    )

    class Meta:
        db_table = 'data_deletion_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'Deletion request by {self.user.email} - {self.status}'

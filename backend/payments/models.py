import uuid
from django.db import models
from core.models import TimestampedModel


class PaymentIntent(TimestampedModel):
    """Tracks a pending payment for an invoice."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('va_bca', 'Virtual Account BCA'),
        ('va_bni', 'Virtual Account BNI'),
        ('va_bri', 'Virtual Account BRI'),
        ('va_mandiri', 'Virtual Account Mandiri'),
        ('va_permata', 'Virtual Account Permata'),
        ('gopay', 'GoPay'),
        ('ovo', 'OVO'),
        ('dana', 'DANA'),
        ('shopeepay', 'ShopeePay'),
        ('qris', 'QRIS'),
        ('credit_card', 'Credit Card'),
        ('indomaret', 'Indomaret'),
        ('alfamart', 'Alfamart'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(
        'finance.Invoice', on_delete=models.CASCADE, related_name='payment_intents',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
        related_name='payment_intents',
    )
    user = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='payment_intents',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='IDR')
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHOD_CHOICES, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    idempotency_key = models.CharField(max_length=100, unique=True, db_index=True)

    # Midtrans fields
    midtrans_order_id = models.CharField(max_length=100, blank=True, default='', db_index=True)
    midtrans_token = models.TextField(blank=True, default='')
    midtrans_redirect_url = models.URLField(max_length=500, blank=True, default='')
    midtrans_fraud_status = models.CharField(max_length=50, blank=True, default='')

    expires_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payment_intents'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice', 'status']),
            models.Index(fields=['midtrans_order_id']),
        ]

    def __str__(self):
        return f'{self.id} - {self.amount} {self.currency} ({self.status})'


class PaymentTransaction(TimestampedModel):
    """Immutable record of a payment attempt. Write-once — state changes create new rows."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('settlement', 'Settlement'),
        ('capture', 'Capture'),
        ('deny', 'Deny'),
        ('challenge', 'Challenge'),
        ('cancel', 'Cancel'),
        ('expire', 'Expire'),
        ('refund', 'Refund'),
        ('partial_refund', 'Partial Refund'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_intent = models.ForeignKey(
        PaymentIntent, on_delete=models.CASCADE, related_name='transactions',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
        related_name='payment_transactions',
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='IDR')

    # Midtrans webhook data (stored for audit)
    midtrans_status_code = models.CharField(max_length=10, blank=True, default='')
    midtrans_status_message = models.TextField(blank=True, default='')
    midtrans_transaction_id = models.CharField(max_length=100, blank=True, default='')
    midtrans_transaction_time = models.CharField(max_length=50, blank=True, default='')
    midtrans_settlement_time = models.CharField(max_length=50, blank=True, default='')
    midtrans_payment_type = models.CharField(max_length=50, blank=True, default='')
    midtrans_fraud_status = models.CharField(max_length=50, blank=True, default='')

    webhook_received_at = models.DateTimeField(auto_now_add=True)
    webhook_raw = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'payment_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['midtrans_transaction_id']),
            models.Index(fields=['payment_intent', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding and self.pk:
            raise ValueError('PaymentTransaction is immutable')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.id} - {self.status} - {self.amount}'


class PaymentRefund(TimestampedModel):
    """Refund request — requires dual approval (Treasurer requests, Owner approves)."""
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.ForeignKey(
        PaymentTransaction, on_delete=models.CASCADE, related_name='refunds',
    )
    invoice = models.ForeignKey(
        'finance.Invoice', on_delete=models.CASCADE, related_name='refunds',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
        related_name='payment_refunds',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')

    requested_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True,
        related_name='refunds_requested',
    )
    approved_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='refunds_approved',
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    midtrans_refund_id = models.CharField(max_length=100, blank=True, default='')
    midtrans_status = models.CharField(max_length=50, blank=True, default='')

    class Meta:
        db_table = 'payment_refunds'
        ordering = ['-created_at']

    def __str__(self):
        return f'Refund {self.id} - {self.amount} ({self.status})'

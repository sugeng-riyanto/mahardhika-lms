import uuid
import hashlib
import json
from django.db import models
from core.models import TimestampedModel


class Certificate(TimestampedModel):
    """Completion certificate with verification code and revocation status."""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('revoked', 'Revoked'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='certificates',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
        related_name='certificates',
    )
    course = models.ForeignKey(
        'courses.Course', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='certificates',
    )
    programme = models.ForeignKey(
        'courses.Programme', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='certificates',
    )
    certificate_number = models.CharField(max_length=50, unique=True, db_index=True)
    verification_code = models.CharField(max_length=64, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    recipient_name = models.CharField(max_length=255)
    recipient_email = models.CharField(max_length=255)
    issued_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.TextField(blank=True, default='')
    revoked_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='certificates_revoked',
    )
    issued_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='certificates_issued',
    )
    metadata = models.JSONField(default=dict, blank=True)
    previous_hash = models.CharField(max_length=64, blank=True, default='', help_text='Hash of the previous certificate in the chain')
    block_hash = models.CharField(max_length=64, blank=True, default='', help_text='SHA-256 hash of this certificate block')
    block_index = models.PositiveIntegerField(default=0, help_text='Sequential index in the blockchain')

    class Meta:
        db_table = 'certificates'
        ordering = ['block_index']

    def __str__(self):
        return f'{self.certificate_number} - {self.recipient_name}'

    def save(self, *args, **kwargs):
        if not self.certificate_number:
            self.certificate_number = self._generate_number()
        if not self.verification_code:
            self.verification_code = self._generate_verification()
        # Build blockchain hash chain on first save
        if not self.block_hash:
            last = Certificate.objects.order_by('-block_index').first()
            self.block_index = (last.block_index + 1) if last else 1
            self.previous_hash = last.block_hash if last else '0' * 64
            super().save(*args, **kwargs)
            self.block_hash = self.compute_block_hash()
            Certificate.objects.filter(pk=self.pk).update(block_hash=self.block_hash)
        else:
            super().save(*args, **kwargs)

    def compute_block_hash(self):
        """Compute SHA-256 block hash from certificate fields + previous hash."""
        payload = json.dumps({
            'index': self.block_index,
            'certificate_number': self.certificate_number,
            'recipient_name': self.recipient_name,
            'recipient_email': self.recipient_email,
            'title': self.title,
            'issued_date': str(self.issued_date),
            'verification_code': self.verification_code,
            'status': self.status,
            'previous_hash': self.previous_hash,
        }, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()

    def verify_chain(self):
        """Verify this certificate's hash is valid and links to the previous block."""
        computed = self.compute_block_hash()
        if computed != self.block_hash:
            return False, 'Block hash mismatch'
        if self.block_index > 1 and self.previous_hash:
            try:
                prev = Certificate.objects.get(block_index=self.block_index - 1)
                if prev.block_hash != self.previous_hash:
                    return False, 'Chain broken: previous hash mismatch'
            except Certificate.DoesNotExist:
                return False, 'Chain broken: previous certificate not found'
        return True, 'Chain verified'

    def _generate_number(self):
        prefix = 'AKD-CERT'
        year = self.issued_date.year if self.issued_date else '2026'
        seq = Certificate.objects.filter(
            organisation=self.organisation, issued_date__year=self.issued_date.year if self.issued_date else None,
        ).count() + 1
        return f'{prefix}-{year}-{seq:04d}'

    def _generate_verification(self):
        raw = f'{self.id}{self.recipient_id}{self.certificate_number}{uuid.uuid4()}'
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    @property
    def verification_url(self):
        return f'/verify-certificate/{self.verification_code}'

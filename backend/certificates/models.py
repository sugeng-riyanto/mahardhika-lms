import uuid
import hashlib
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

    class Meta:
        db_table = 'certificates'
        ordering = ['-issued_date']

    def __str__(self):
        return f'{self.certificate_number} - {self.recipient_name}'

    def save(self, *args, **kwargs):
        if not self.certificate_number:
            self.certificate_number = self._generate_number()
        if not self.verification_code:
            self.verification_code = self._generate_verification()
        super().save(*args, **kwargs)

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

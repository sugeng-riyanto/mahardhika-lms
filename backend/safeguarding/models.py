from django.db import models
from core.models import TimestampedModel


class SafeguardingReport(TimestampedModel):
    """Safeguarding incident report."""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('investigating', 'Investigating'),
        ('resolved', 'Resolved'),
        ('escalated', 'Escalated'),
    ]

    reporter = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, related_name='safeguarding_reports_filed',
    )
    subject_user = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, related_name='safeguarding_reports_subject',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    description = models.TextField()
    assigned_to = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='safeguarding_reports_assigned',
    )

    class Meta:
        db_table = 'safeguarding_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f'Report {self.id} - {self.status}'

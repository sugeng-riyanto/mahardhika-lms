from django.db import models
from core.models import TimestampedModel


class SponsorshipProgramme(TimestampedModel):
    """Sponsored programme record."""
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
        related_name='sponsorship_programmes',
    )
    sponsor_user = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE,
        related_name='sponsorships',
    )
    name = models.CharField(max_length=255)
    fund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    fund_utilised = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'sponsorship_programmes'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

from django.db import models
from core.models import TimestampedModel


class Invoice(TimestampedModel):
    """Finance invoice."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]

    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE, related_name='invoices',
    )
    user = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='invoices',
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='IDR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.invoice_number} - {self.amount} {self.currency}'

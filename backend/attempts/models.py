import uuid
from django.db import models
from core.models import TimestampedModel


class Attempt(TimestampedModel):
    """Student attempt at an activity."""
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('voided', 'Voided'),
    ]

    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='attempts',
    )
    activity = models.ForeignKey(
        'activities.ActivityDefinition',
        on_delete=models.PROTECT,
        related_name='attempts',
        null=True,
        blank=True,
    )
    activity_version = models.ForeignKey(
        'activities.ActivityVersion', on_delete=models.PROTECT, related_name='attempts',
        null=True, blank=True,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    letter_grade = models.CharField(max_length=2, blank=True, default='')
    passed = models.BooleanField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=255, unique=True, null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    attempt_number = models.PositiveIntegerField(default=1)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'attempts'
        ordering = ['-created_at']

    def __str__(self):
        return f'Attempt {self.id} by {self.student.email}'

    def save(self, *args, **kwargs):
        if not self.idempotency_key:
            self.idempotency_key = str(uuid.uuid4())
        super().save(*args, **kwargs)


class Response(TimestampedModel):
    """Individual response within an attempt."""
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='responses')
    question = models.ForeignKey(
        'activities.ActivityQuestion',
        on_delete=models.CASCADE,
        related_name='responses',
        null=True,
        blank=True,
    )
    answer_data = models.JSONField(default=dict)
    score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    feedback = models.TextField(blank=True, default='')
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'responses'
        ordering = ['id']

    def __str__(self):
        return f'Response for {self.attempt.id}'

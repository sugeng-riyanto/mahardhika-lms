from django.db import models
from core.models import TimestampedModel


class Grade(TimestampedModel):
    """Current grade for a student on an activity."""
    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='grades',
    )
    activity = models.ForeignKey(
        'activities.ActivityDefinition', on_delete=models.CASCADE, related_name='grades',
    )
    attempt = models.ForeignKey(
        'attempts.Attempt', on_delete=models.SET_NULL, null=True, related_name='grade_record',
    )
    score = models.DecimalField(max_digits=10, decimal_places=2)
    max_score = models.DecimalField(max_digits=10, decimal_places=2)
    released = models.BooleanField(default=False)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'grades'
        unique_together = ['student', 'activity']
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.student.email} - {self.score}/{self.max_score}'


class GradeEvent(TimestampedModel):
    """Immutable grade history event."""
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name='events')
    previous_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    new_score = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField(blank=True, default='')
    actor = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True,
    )

    class Meta:
        db_table = 'grade_events'
        ordering = ['-created_at']

    def __str__(self):
        return f'Grade event {self.id}'

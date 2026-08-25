from django.db import models
from core.models import TimestampedModel


class CompletionRecord(TimestampedModel):
    """Tracks student completion of lessons and courses."""
    COMPLETION_TYPE_CHOICES = [
        ('lesson', 'Lesson'),
        ('course', 'Course'),
        ('activity', 'Activity'),
    ]

    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='completion_records',
    )
    course = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE, related_name='completion_records',
    )
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='completion_records',
    )
    activity = models.ForeignKey(
        'activities.ActivityDefinition', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='completion_records',
    )
    completion_type = models.CharField(max_length=20, choices=COMPLETION_TYPE_CHOICES)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    progress_percent = models.PositiveIntegerField(default=0)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'completion_records'
        unique_together = [
            ['student', 'lesson'],
            ['student', 'activity'],
        ]
        ordering = ['-completed_at']

    def __str__(self):
        return f'{self.student.email} - {self.completion_type} ({self.progress_percent}%)'


class CourseProgress(TimestampedModel):
    """Aggregated course progress for a student."""
    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='course_progress',
    )
    course = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE, related_name='course_progress',
    )
    total_lessons = models.PositiveIntegerField(default=0)
    completed_lessons = models.PositiveIntegerField(default=0)
    total_activities = models.PositiveIntegerField(default=0)
    completed_activities = models.PositiveIntegerField(default=0)
    overall_percent = models.PositiveIntegerField(default=0)
    is_course_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'course_progress'
        unique_together = ['student', 'course']
        ordering = ['-overall_percent']

    def __str__(self):
        return f'{self.student.email} - {self.course.title} ({self.overall_percent}%)'

    def recalculate(self):
        """Recalculate progress from completion records."""
        from django.utils import timezone

        lessons_completed = CompletionRecord.objects.filter(
            student=self.student, course=self.course,
            completion_type='lesson', is_completed=True,
        ).count()

        activities_completed = CompletionRecord.objects.filter(
            student=self.student, course=self.course,
            completion_type='activity', is_completed=True,
        ).count()

        self.completed_lessons = lessons_completed
        self.completed_activities = activities_completed

        # Calculate overall percent
        total = self.total_lessons + self.total_activities
        completed = lessons_completed + activities_completed
        self.overall_percent = int((completed / total * 100)) if total > 0 else 0

        # Check if course is fully completed
        if self.total_lessons > 0 and lessons_completed >= self.total_lessons:
            if self.total_activities == 0 or activities_completed >= self.total_activities:
                if not self.is_course_completed:
                    self.is_course_completed = True
                    self.completed_at = timezone.now()

        self.last_activity_at = timezone.now()
        self.save()

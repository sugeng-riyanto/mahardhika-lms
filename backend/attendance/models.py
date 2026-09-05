from django.db import models
from django.utils import timezone
from core.models import TimestampedModel


def validate_face_thumbnail(value):
    """Ensure face thumbnail is compact base64 JPEG under 50KB."""
    if not value:
        return
    # Strip data-URL prefix if present
    raw = value
    if ',' in raw and raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    # Rough size check: base64 ~4/3 of raw bytes
    raw_bytes = len(raw) * 3 // 4
    if raw_bytes > 50 * 1024:
        raise models.ValidationError('Face thumbnail must be under 50 KB.')


class LessonSchedule(TimestampedModel):
    """Scheduled occurrence of a lesson on a specific date/time."""

    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE,
        related_name='schedules',
    )
    course = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE,
        related_name='lesson_schedules',
    )
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True, default='')
    is_cancelled = models.BooleanField(default=False)
    cancellation_reason = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'lesson_schedules'
        ordering = ['date', 'start_time']
        unique_together = ['lesson', 'date']

    def __str__(self):
        return f'{self.lesson.title} on {self.date}'


class AttendanceRecord(TimestampedModel):
    """Per-student attendance for a scheduled lesson."""

    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]

    schedule = models.ForeignKey(
        LessonSchedule, on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='absent')
    notes = models.TextField(blank=True, default='')
    marked_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='attendance_marked',
    )
    marked_at = models.DateTimeField(null=True, blank=True)

    # Self-check-in fields (face + geolocation)
    face_thumbnail = models.TextField(
        blank=True, default='',
        help_text='Base64-encoded JPEG thumbnail (≤100×100 px, ≤50 KB).',
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )
    location_accuracy_m = models.FloatField(
        null=True, blank=True,
        help_text='GPS accuracy in metres at check-in time.',
    )
    self_checked = models.BooleanField(
        default=False,
        help_text='True if the student checked in themselves (vs instructor roll).',
    )

    class Meta:
        db_table = 'attendance_records'
        unique_together = ['schedule', 'student']
        ordering = ['-schedule__date', 'student__email']

    def __str__(self):
        return f'{self.student.email} - {self.status} on {self.schedule.date}'

    def save(self, *args, **kwargs):
        if not self.marked_at and self.status != 'absent':
            self.marked_at = timezone.now()
        super().save(*args, **kwargs)

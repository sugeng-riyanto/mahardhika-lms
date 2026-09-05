from django.db import models
from core.models import TimestampedModel


class Programme(TimestampedModel):
    """Educational programme (JHS, SHS, PKBM, STEAM, etc.)."""
    LEVEL_CHOICES = [
        ('jhs', 'Junior High School'),
        ('shs', 'Senior High School'),
        ('pkbm', 'PKBM'),
        ('academy', 'Academy'),
        ('steam', 'STEAM Camp'),
        ('arts', 'Arts Camp'),
        ('ielts', 'IELTS'),
        ('teacher_dev', 'Teacher Development'),
    ]

    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.CASCADE,
        related_name='programmes',
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True, default='')
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'programmes'
        ordering = ['name']
        unique_together = ['organisation', 'slug']

    def __str__(self):
        return self.name


class Course(TimestampedModel):
    """Course within a programme."""
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='courses',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.CASCADE,
        related_name='courses',
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True, default='')
    instructor = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='instructed_courses',
    )
    is_published = models.BooleanField(default=False)
    thumbnail_url = models.URLField(max_length=500, blank=True, default='')

    class Meta:
        db_table = 'courses'
        ordering = ['-created_at']
        unique_together = ['programme', 'slug']

    def __str__(self):
        return self.title


class Lesson(TimestampedModel):
    """Lesson within a course."""
    CONTENT_TYPE_CHOICES = [
        ('text', 'Text'),
        ('video', 'Video'),
        ('activity', 'Activity'),
        ('essay', 'Essay'),
    ]

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='lessons',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    content_data = models.JSONField(default=dict, blank=True)
    video_url = models.URLField(
        max_length=500, blank=True, default='',
        help_text='YouTube or Google Drive embed URL for inline video',
    )
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = 'lessons'
        ordering = ['order']

    def __str__(self):
        return self.title


class Enrolment(TimestampedModel):
    """Student enrolment in a course."""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('dropped', 'Dropped'),
    ]

    student = models.ForeignKey(
        'identity.User',
        on_delete=models.CASCADE,
        related_name='enrolments',
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrolments',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    enrolled_by = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='enrolments_created',
    )

    class Meta:
        db_table = 'enrolments'
        unique_together = ['student', 'course']
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.student.email} -> {self.course.title}'

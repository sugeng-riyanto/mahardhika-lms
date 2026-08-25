from django.db import models
from core.models import TimestampedModel


class Assignment(TimestampedModel):
    """An assignment within a course lesson."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    course = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE, related_name='assignments',
    )
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assignments',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation', on_delete=models.CASCADE,
        related_name='assignments',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    instructions = models.TextField(blank=True, default='')
    max_score = models.PositiveIntegerField(default=100)
    max_attempts = models.PositiveIntegerField(default=1)
    due_date = models.DateTimeField(null=True, blank=True)
    allow_late = models.BooleanField(default=False)
    late_penalty_percent = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True,
        related_name='assignments_created',
    )
    allowed_file_types = models.JSONField(
        default=list, blank=True,
        help_text='List of allowed file extensions, e.g. [".pdf", ".docx"]',
    )
    max_file_size_mb = models.PositiveIntegerField(default=10)

    class Meta:
        db_table = 'assignments'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def submission_count(self):
        return self.submissions.count()

    @property
    def graded_count(self):
        return self.submissions.filter(status='graded').count()


class AssignmentSubmission(TimestampedModel):
    """A student's submission for an assignment."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('returned', 'Returned for Revision'),
    ]

    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name='submissions',
    )
    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE, related_name='assignment_submissions',
    )
    attempt_number = models.PositiveIntegerField(default=1)
    content_data = models.JSONField(
        default=dict, blank=True,
        help_text='Text response or structured submission data',
    )
    file_urls = models.JSONField(
        default=list, blank=True,
        help_text='List of uploaded file URLs',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    score = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
    )
    feedback = models.TextField(blank=True, default='')
    feedback_files = models.JSONField(default=list, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    graded_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='submissions_graded',
    )

    class Meta:
        db_table = 'assignment_submissions'
        unique_together = ['assignment', 'student', 'attempt_number']
        ordering = ['-submitted_at']

    def __str__(self):
        return f'{self.student.email} - {self.assignment.title} (attempt {self.attempt_number})'

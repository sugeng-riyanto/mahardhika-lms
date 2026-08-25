import hashlib
import json
from django.db import models
from django.utils import timezone
from core.models import TimestampedModel


class CanvasDocument(TimestampedModel):
    """
    Canvas document with 4-layer separation:
    - question_data: Set by instructor before assessment is published (read-only for student)
    - student_answer_data: Student's work (locked after submission)
    - teacher_feedback_data: Instructor feedback (only instructor can modify)
    - student_revision_data: Available if revision is opened
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('returned', 'Returned for Revision'),
        ('finalised', 'Finalised'),
    ]

    schema_version = models.PositiveIntegerField(default=1)
    essay_response = models.ForeignKey(
        'essays.EssayResponse',
        on_delete=models.CASCADE,
        related_name='canvas_documents',
        null=True,
        blank=True,
    )
    student = models.ForeignKey(
        'identity.User',
        on_delete=models.CASCADE,
        related_name='canvas_documents',
    )
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        related_name='canvas_documents',
        null=True,
        blank=True,
    )

    # 4-layer data
    question_data = models.JSONField(default=dict, blank=True, help_text='Instructor-authored question layer')
    student_answer_data = models.JSONField(default=dict, blank=True, help_text='Student answer layer')
    teacher_feedback_data = models.JSONField(default=dict, blank=True, help_text='Teacher feedback layer')
    student_revision_data = models.JSONField(default=dict, blank=True, help_text='Student revision layer')

    # Canvas dimensions
    page_width = models.PositiveIntegerField(default=1240)
    page_height = models.PositiveIntegerField(default=1754)

    # Status & submission
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_version = models.PositiveIntegerField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)

    # Version tracking
    document_version = models.PositiveIntegerField(default=1)
    checksum = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        db_table = 'canvas_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f'Canvas {self.id} v{self.document_version} ({self.status})'

    def compute_checksum(self):
        """Compute SHA-256 checksum of all layer data for conflict detection."""
        data = json.dumps({
            'q': self.question_data,
            's': self.student_answer_data,
            't': self.teacher_feedback_data,
            'r': self.student_revision_data,
        }, sort_keys=True, default=str)
        self.checksum = hashlib.sha256(data.encode()).hexdigest()[:16]
        return self.checksum

    def save(self, *args, **kwargs):
        self.compute_checksum()
        super().save(*args, **kwargs)


class CanvasVersion(TimestampedModel):
    """
    Immutable version snapshot for canvas document history.
    Each save creates a new version record.
    """

    document = models.ForeignKey(
        CanvasDocument,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.PositiveIntegerField()
    author = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='canvas_versions',
    )

    # Snapshot of all layers at this version
    question_data = models.JSONField(default=dict, blank=True)
    student_answer_data = models.JSONField(default=dict, blank=True)
    teacher_feedback_data = models.JSONField(default=dict, blank=True)
    student_revision_data = models.JSONField(default=dict, blank=True)

    description = models.CharField(max_length=255, blank=True, default='')
    checksum = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        db_table = 'canvas_versions'
        ordering = ['-version_number']
        unique_together = ['document', 'version_number']

    def __str__(self):
        return f'{self.document} v{self.version_number}'

    def save(self, *args, **kwargs):
        if not self.checksum:
            data = json.dumps({
                'q': self.question_data,
                's': self.student_answer_data,
                't': self.teacher_feedback_data,
                'r': self.student_revision_data,
            }, sort_keys=True, default=str)
            self.checksum = hashlib.sha256(data.encode()).hexdigest()[:16]
        super().save(*args, **kwargs)

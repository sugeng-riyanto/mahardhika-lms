from django.db import models
from django.utils import timezone
from core.models import TimestampedModel


class ContentItem(TimestampedModel):
    """
    Content library item with lifecycle workflow.

    States:
        draft       — Created by instructor, not yet submitted
        review      — Submitted for admin/owner review
        published   — Approved and visible to students
        archived    — Removed from active use (read-only)

    Transitions:
        draft → review        (instructor submits for review)
        review → published    (admin/owner approves)
        review → draft        (admin/owner returns for revision)
        published → archived  (admin/owner archives)
        archived → draft      (admin/owner reverts to draft)
        draft → archived      (admin/owner deletes/archives directly)
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('review', 'Under Review'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    CONTENT_TYPE_CHOICES = [
        ('document', 'Document'),
        ('video', 'Video'),
        ('image', 'Image'),
        ('audio', 'Audio'),
        ('interactive', 'Interactive'),
        ('other', 'Other'),
    ]

    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.CASCADE,
        related_name='content_items',
    )
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_items',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    file_url = models.URLField(max_length=500, blank=True, default='')
    mime_type = models.CharField(max_length=100, blank=True, default='')
    file_size = models.PositiveIntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    uploaded_by = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='content_items',
    )

    # Lifecycle fields
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_for_review_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_reviewed',
    )
    review_notes = models.TextField(blank=True, default='')
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'content_items'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'


class ContentStatusLog(TimestampedModel):
    """
    Immutable audit log for content status transitions.
    """

    ACTION_CHOICES = [
        ('created', 'Created'),
        ('submitted_for_review', 'Submitted for Review'),
        ('approved', 'Approved'),
        ('returned', 'Returned for Revision'),
        ('published', 'Published'),
        ('archived', 'Archived'),
        ('reverted', 'Reverted to Draft'),
    ]

    content_item = models.ForeignKey(
        ContentItem,
        on_delete=models.CASCADE,
        related_name='status_logs',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    from_status = models.CharField(max_length=20, blank=True, default='')
    to_status = models.CharField(max_length=20)
    notes = models.TextField(blank=True, default='')
    performed_by = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='content_status_logs',
    )

    class Meta:
        db_table = 'content_status_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action}: {self.from_status} → {self.to_status}'

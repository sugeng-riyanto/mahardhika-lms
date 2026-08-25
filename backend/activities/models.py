from django.db import models
from core.models import TimestampedModel


class ActivityDefinition(TimestampedModel):
    """Interactive activity definition."""
    TYPE_CHOICES = [
        ('multiple_choice', 'Multiple Choice'),
        ('multiple_select', 'Multiple Select'),
        ('true_false', 'True/False'),
        ('image_hotspot', 'Image Hotspot'),
        ('drag_and_drop', 'Drag and Drop'),
        ('interactive_video', 'Interactive Video'),
        ('branching_scenario', 'Branching Scenario'),
        ('essay', 'Essay'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('in_review', 'In Review'),
        ('changes_requested', 'Changes Requested'),
        ('approved', 'Approved'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.CASCADE,
        related_name='activity_definitions',
    )
    lesson = models.ForeignKey(
        'courses.Lesson',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_definitions',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    activity_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    schema_version = models.PositiveIntegerField(default=1)
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True, help_text='Time limit in minutes, null = unlimited')
    max_attempts = models.PositiveIntegerField(default=1, help_text='Maximum number of attempts allowed')
    shuffle_questions = models.BooleanField(default=False)
    show_correct_answers = models.BooleanField(default=True, help_text='Show correct answers after submission')
    pass_mark_percentage = models.PositiveIntegerField(default=50, help_text='Percentage needed to pass')
    settings = models.JSONField(default=dict, blank=True)
    content = models.JSONField(default=dict, blank=True)
    grading = models.JSONField(default=dict, blank=True)
    accessibility = models.JSONField(default=dict, blank=True)
    learning_objectives = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        'identity.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_activities',
    )

    class Meta:
        db_table = 'activity_definitions'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def total_points(self):
        return sum(q.points for q in self.questions.all())

    @property
    def question_count(self):
        return self.questions.count()


class ActivityQuestion(TimestampedModel):
    """Individual question within an activity."""
    QUESTION_TYPE_CHOICES = [
        ('multiple_choice', 'Multiple Choice'),
        ('multiple_select', 'Multiple Select'),
        ('true_false', 'True/False'),
        ('image_hotspot', 'Image Hotspot'),
        ('drag_and_drop', 'Drag and Drop'),
    ]

    activity = models.ForeignKey(
        ActivityDefinition,
        on_delete=models.CASCADE,
        related_name='questions',
    )
    question_type = models.CharField(max_length=30, choices=QUESTION_TYPE_CHOICES)
    title = models.CharField(max_length=500, blank=True, default='')
    prompt = models.TextField(help_text='Question text or prompt')
    image_url = models.URLField(max_length=500, blank=True, default='')
    options = models.JSONField(
        default=list,
        help_text='List of option objects: [{"id": "a", "text": "...", "image_url": "..."}]',
    )
    correct_answer = models.JSONField(
        help_text='Correct answer value: string for MC/TF, list of strings for MS/DnD',
    )
    explanation = models.TextField(blank=True, default='', help_text='Explanation shown after submission')
    points = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'activity_questions'
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.title or self.prompt[:80]


class ActivityVersion(TimestampedModel):
    """Immutable published version of an activity."""
    definition = models.ForeignKey(
        ActivityDefinition,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version_number = models.PositiveIntegerField()
    content = models.JSONField()
    settings = models.JSONField(default=dict)
    grading = models.JSONField(default=dict)
    checksum = models.CharField(max_length=64)

    class Meta:
        db_table = 'activity_versions'
        unique_together = ['definition', 'version_number']
        ordering = ['-version_number']

    def __str__(self):
        return f'{self.definition.title} v{self.version_number}'

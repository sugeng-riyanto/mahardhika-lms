import uuid
from django.db import models
from django.utils import timezone
from core.models import TimestampedModel


class EssayQuestion(TimestampedModel):
    """Essay question authored by an instructor."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    content_data = models.JSONField(default=dict)
    marks = models.PositiveIntegerField(default=0)
    expected_answer = models.TextField(blank=True, default='')
    learning_objectives = models.JSONField(default=list, blank=True)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    max_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    allow_canvas_response = models.BooleanField(default=True)
    allow_typed_response = models.BooleanField(default=True)
    allow_file_upload = models.BooleanField(default=False)
    late_submission_allowed = models.BooleanField(default=True)
    late_penalty_percent = models.PositiveIntegerField(default=0)
    video_url = models.CharField(max_length=500, blank=True, default='')
    # FK relationships
    course = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE,
        null=True, blank=True, related_name='essay_questions',
    )
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='essay_questions',
    )
    created_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL,
        null=True, related_name='essay_questions',
    )

    class Meta:
        db_table = 'essay_questions'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class EssayResponse(TimestampedModel):
    """Student response to an essay question."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('locked', 'Locked'),
        ('grading', 'Grading'),
        ('returned', 'Returned'),
        ('resubmitted', 'Resubmitted'),
        ('finalised', 'Finalised'),
    ]

    question = models.ForeignKey(
        EssayQuestion, on_delete=models.CASCADE,
        related_name='responses',
    )
    student = models.ForeignKey(
        'identity.User', on_delete=models.CASCADE,
        related_name='essay_responses',
    )
    # Content
    typed_answer = models.TextField(blank=True, default='')
    canvas_data = models.JSONField(default=dict, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    # Status & submission
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    is_late = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    # Scores (computed from rubric scores)
    total_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    letter_grade = models.CharField(max_length=2, blank=True, default='')
    # Feedback
    overall_feedback = models.TextField(blank=True, default='')
    feedback_released = models.BooleanField(default=False)
    feedback_released_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    return_reason = models.TextField(blank=True, default='')
    # Moderation
    marked_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='marked_essays',
    )

    class Meta:
        db_table = 'essay_responses'
        ordering = ['-submitted_at', '-created_at']
        unique_together = ['question', 'student', 'version']

    def __str__(self):
        return f'{self.student.email} - {self.question.title} v{self.version}'

    def compute_letter_grade(self):
        """Compute letter grade from percentage."""
        if self.percentage is None:
            return ''
        p = float(self.percentage)
        if p >= 90:
            return 'A+'
        elif p >= 85:
            return 'A'
        elif p >= 80:
            return 'A-'
        elif p >= 75:
            return 'B+'
        elif p >= 70:
            return 'B'
        elif p >= 65:
            return 'B-'
        elif p >= 60:
            return 'C+'
        elif p >= 55:
            return 'C'
        elif p >= 50:
            return 'C-'
        elif p >= 40:
            return 'D'
        return 'F'


class RubricCriterion(TimestampedModel):
    """A single criterion in the rubric for an essay question."""

    question = models.ForeignKey(
        EssayQuestion, on_delete=models.CASCADE,
        related_name='rubric_criteria',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    max_score = models.DecimalField(max_digits=10, decimal_places=2)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'rubric_criteria'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'{self.name} ({self.max_score} pts)'


class RubricLevel(TimestampedModel):
    """Performance level for a rubric criterion."""

    criterion = models.ForeignKey(
        RubricCriterion, on_delete=models.CASCADE,
        related_name='levels',
    )
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    score = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'rubric_levels'
        ordering = ['-score']

    def __str__(self):
        return f'{self.label} ({self.score} pts)'


class RubricScore(TimestampedModel):
    """Teacher's score on a single rubric criterion for a student response."""

    response = models.ForeignKey(
        EssayResponse, on_delete=models.CASCADE,
        related_name='rubric_scores',
    )
    criterion = models.ForeignKey(
        RubricCriterion, on_delete=models.CASCADE,
        related_name='scores',
    )
    score = models.DecimalField(max_digits=10, decimal_places=2)
    comment = models.TextField(blank=True, default='')
    scored_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL,
        null=True, related_name='rubric_scores',
    )

    class Meta:
        db_table = 'rubric_scores'
        unique_together = ['response', 'criterion']

    def __str__(self):
        return f'{self.criterion.name}: {self.score}/{self.criterion.max_score}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recompute parent response totals
        self._update_response_totals()

    def _update_response_totals(self):
        response = self.response
        scores = RubricScore.objects.filter(response=response)
        total = sum(float(s.score) for s in scores)
        max_total = sum(float(s.criterion.max_score) for s in scores)
        response.total_score = total
        response.percentage = round((total / max_total * 100), 2) if max_total > 0 else 0
        response.letter_grade = response.compute_letter_grade()
        response.save(update_fields=['total_score', 'percentage', 'letter_grade', 'updated_at'])


class InlineFeedback(TimestampedModel):
    """Teacher inline annotation/feedback on a specific part of the response."""

    ANCHOR_TYPE_CHOICES = [
        ('text', 'Text Position'),
        ('canvas', 'Canvas Position'),
        ('general', 'General'),
    ]

    response = models.ForeignKey(
        EssayResponse, on_delete=models.CASCADE,
        related_name='inline_feedbacks',
    )
    anchor_type = models.CharField(max_length=20, choices=ANCHOR_TYPE_CHOICES, default='general')
    # For text anchors
    text_start = models.PositiveIntegerField(null=True, blank=True)
    text_end = models.PositiveIntegerField(null=True, blank=True)
    selected_text = models.TextField(blank=True, default='')
    # For canvas anchors
    canvas_x = models.FloatField(null=True, blank=True)
    canvas_y = models.FloatField(null=True, blank=True)
    canvas_width = models.FloatField(null=True, blank=True)
    canvas_height = models.FloatField(null=True, blank=True)
    # Content
    comment = models.TextField()
    is_visible_to_student = models.BooleanField(default=True)
    # Author
    created_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL,
        null=True, related_name='inline_feedbacks',
    )

    class Meta:
        db_table = 'inline_feedbacks'
        ordering = ['created_at']

    def __str__(self):
        return f'Feedback on {self.response}: {self.comment[:50]}'

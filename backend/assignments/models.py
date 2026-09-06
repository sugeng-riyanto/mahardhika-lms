import hashlib

from django.db import models
from core.models import TimestampedModel


class Assignment(TimestampedModel):
    """An assignment within a course lesson."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    TASK_TYPE_CHOICES = [
        ('file', 'File / Text Submission'),
        ('mcq', 'Multiple Choice Quiz'),
        ('essay', 'Essay Task'),
        ('combined', 'Combined (MCQ + Essay)'),
        ('exam', 'Exam (PDF Paper + Answer Sheet)'),
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
    task_type = models.CharField(
        max_length=20, choices=TASK_TYPE_CHOICES, default='file',
        help_text='What kind of task this is: file/text submission, MCQ quiz, essay task, or a combination.',
    )
    essay_questions = models.ManyToManyField(
        'essays.EssayQuestion', blank=True, related_name='assignments',
        help_text='Essay questions included in this task (for essay and combined tasks).',
    )
    created_by = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True,
        related_name='assignments_created',
    )
    allowed_file_types = models.JSONField(
        default=list, blank=True,
        help_text='List of allowed file extensions, e.g. [".pdf", ".docx"]',
    )
    max_file_size_mb = models.PositiveIntegerField(default=10)
    video_url = models.URLField(
        max_length=500, blank=True, default='',
        help_text='YouTube or Google Drive embed URL for a video brief',
    )
    exam_pdf_name = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Original PDF filename for exam tasks',
    )
    exam_pages = models.JSONField(
        default=list, blank=True,
        help_text='Rendered page images (data URLs) of the uploaded exam PDF, in page order',
    )

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

    @property
    def mcq_total_points(self):
        return sum(q.points for q in self.questions.all())


class AssignmentQuestion(TimestampedModel):
    """A multiple-choice style question within an assignment (auto-scored)."""
    QUESTION_TYPE_CHOICES = [
        ('multiple_choice', 'Multiple Choice'),
        ('true_false', 'True/False'),
        ('multiple_select', 'Multiple Select'),
    ]

    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name='questions',
    )
    question_type = models.CharField(max_length=30, choices=QUESTION_TYPE_CHOICES)
    prompt = models.TextField(help_text='Question text or prompt')
    options = models.JSONField(
        default=list,
        help_text='List of option objects: [{"id": "a", "text": "..."}]',
    )
    correct_answer = models.JSONField(
        default=list,
        help_text='Correct answer: ["a"] for MC/TF, ["a", "c"] for multiple select',
    )
    explanation = models.TextField(blank=True, default='', help_text='Explanation shown after submission')
    points = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)
    page = models.PositiveIntegerField(
        default=1,
        help_text='PDF page number this question appears on (exam tasks)',
    )

    class Meta:
        db_table = 'assignment_questions'
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.prompt[:80]


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
    verify_hash = models.CharField(
        max_length=64, unique=True, null=True, blank=True, db_index=True,
        help_text='Public verification hash for this submission record',
    )

    class Meta:
        db_table = 'assignment_submissions'
        unique_together = ['assignment', 'student', 'attempt_number']
        ordering = ['-submitted_at']

    def save(self, *args, **kwargs):
        if not self.verify_hash:
            payload = (
                f'{self.assignment_id}|{self.student_id}|'
                f'{self.attempt_number}|{self.created_at.isoformat() if self.created_at else ""}'
            )
            self.verify_hash = hashlib.sha256(payload.encode()).hexdigest()[:32]
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.student.email} - {self.assignment.title} (attempt {self.attempt_number})'

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('essays', '0003_essayquestion_video_url'),
        ('assignments', '0002_add_video_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='task_type',
            field=models.CharField(choices=[('file', 'File / Text Submission'), ('mcq', 'Multiple Choice Quiz'), ('essay', 'Essay Task'), ('combined', 'Combined (MCQ + Essay)')], default='file', help_text='What kind of task this is: file/text submission, MCQ quiz, essay task, or a combination.', max_length=20),
        ),
        migrations.AddField(
            model_name='assignment',
            name='essay_questions',
            field=models.ManyToManyField(blank=True, help_text='Essay questions included in this task (for essay and combined tasks).', related_name='assignments', to='essays.essayquestion'),
        ),
        migrations.CreateModel(
            name='AssignmentQuestion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assignment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='assignments.assignment')),
                ('question_type', models.CharField(choices=[('multiple_choice', 'Multiple Choice'), ('true_false', 'True/False'), ('multiple_select', 'Multiple Select')], max_length=30)),
                ('prompt', models.TextField(help_text='Question text or prompt')),
                ('options', models.JSONField(default=list, help_text='List of option objects: [{"id": "a", "text": "..."}]')),
                ('correct_answer', models.JSONField(default=list, help_text='Correct answer: ["a"] for MC/TF, ["a", "c"] for multiple select')),
                ('explanation', models.TextField(blank=True, default='', help_text='Explanation shown after submission')),
                ('points', models.PositiveIntegerField(default=1)),
                ('order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'db_table': 'assignment_questions',
                'ordering': ['order', 'created_at'],
            },
        ),
    ]
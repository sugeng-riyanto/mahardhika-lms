"""
Enhanced 4-layer canvas with CanvasVersion history.

Adds question_data, student_answer_data, teacher_feedback_data,
student_revision_data fields to CanvasDocument, plus a new
CanvasVersion model for immutable version snapshots.
"""

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("canvas", "0001_initial"),
        ("courses", "0001_initial"),
        ("essays", "0002_essayquestion_allow_canvas_response_and_more"),
        ("identity", "0001_initial"),
    ]

    operations = [
        # Add 4-layer fields to CanvasDocument
        migrations.AddField(
            model_name="canvasdocument",
            name="question_data",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Instructor-authored question layer",
            ),
        ),
        migrations.AddField(
            model_name="canvasdocument",
            name="student_answer_data",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Student answer layer",
            ),
        ),
        migrations.AddField(
            model_name="canvasdocument",
            name="teacher_feedback_data",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Teacher feedback layer",
            ),
        ),
        migrations.AddField(
            model_name="canvasdocument",
            name="student_revision_data",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Student revision layer",
            ),
        ),
        # Add student FK
        migrations.AddField(
            model_name="canvasdocument",
            name="student",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="canvas_documents",
                to="identity.user",
            ),
            preserve_default=False,
        ),
        # Add essay_response FK
        migrations.AddField(
            model_name="canvasdocument",
            name="essay_response",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="canvas_documents",
                to="essays.essayresponse",
            ),
        ),
        # Add course FK
        migrations.AddField(
            model_name="canvasdocument",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="canvas_documents",
                to="courses.course",
            ),
        ),
        # Add status field
        migrations.AddField(
            model_name="canvasdocument",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("in_progress", "In Progress"),
                    ("submitted", "Submitted"),
                    ("under_review", "Under Review"),
                    ("returned", "Returned for Revision"),
                    ("finalised", "Finalised"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        # Add is_locked field
        migrations.AddField(
            model_name="canvasdocument",
            name="is_locked",
            field=models.BooleanField(default=False),
        ),
        # Remove old 'pages' and 'layers' fields (if they existed as non-JSON)
        # Keep them for backward compat if needed - just add the new ones above

        # Create CanvasVersion model
        migrations.CreateModel(
            name="CanvasVersion",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, db_index=True),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("version_number", models.PositiveIntegerField()),
                (
                    "question_data",
                    models.JSONField(blank=True, default=dict),
                ),
                (
                    "student_answer_data",
                    models.JSONField(blank=True, default=dict),
                ),
                (
                    "teacher_feedback_data",
                    models.JSONField(blank=True, default=dict),
                ),
                (
                    "student_revision_data",
                    models.JSONField(blank=True, default=dict),
                ),
                (
                    "description",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                (
                    "checksum",
                    models.CharField(blank=True, default="", max_length=64),
                ),
                (
                    "author",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="canvas_versions",
                        to="identity.user",
                    ),
                ),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="canvas.canvasdocument",
                    ),
                ),
            ],
            options={
                "db_table": "canvas_versions",
                "ordering": ["-version_number"],
                "unique_together": {("document", "version_number")},
            },
        ),
    ]

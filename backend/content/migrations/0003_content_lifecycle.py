"""
Add content lifecycle fields and ContentStatusLog model.
"""

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0002_add_course_and_tags"),
        ("identity", "0001_initial"),
    ]

    operations = [
        # Add lifecycle fields to ContentItem
        migrations.AddField(
            model_name="contentitem",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("review", "Under Review"),
                    ("published", "Published"),
                    ("archived", "Archived"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="contentitem",
            name="submitted_for_review_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contentitem",
            name="published_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contentitem",
            name="archived_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contentitem",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="content_reviewed",
                to="identity.user",
            ),
        ),
        migrations.AddField(
            model_name="contentitem",
            name="review_notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="contentitem",
            name="version",
            field=models.PositiveIntegerField(default=1),
        ),

        # Create ContentStatusLog model
        migrations.CreateModel(
            name="ContentStatusLog",
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
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("created", "Created"),
                            ("submitted_for_review", "Submitted for Review"),
                            ("approved", "Approved"),
                            ("returned", "Returned for Revision"),
                            ("published", "Published"),
                            ("archived", "Archived"),
                            ("reverted", "Reverted to Draft"),
                        ],
                        max_length=30,
                    ),
                ),
                ("from_status", models.CharField(blank=True, default="", max_length=20)),
                ("to_status", models.CharField(max_length=20)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "content_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="status_logs",
                        to="content.contentitem",
                    ),
                ),
                (
                    "performed_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="content_status_logs",
                        to="identity.user",
                    ),
                ),
            ],
            options={
                "db_table": "content_status_logs",
                "ordering": ["-created_at"],
            },
        ),
    ]

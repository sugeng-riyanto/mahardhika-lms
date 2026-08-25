"""
Add NotificationPreference, NotificationQueue, and NotificationDeliveryLog models.
"""

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
        ("identity", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificationPreference",
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
                ("email_enabled", models.BooleanField(default=True)),
                ("whatsapp_enabled", models.BooleanField(default=False)),
                ("in_app_enabled", models.BooleanField(default=True)),
                (
                    "quiet_hours_start",
                    models.TimeField(
                        blank=True,
                        help_text="Start of quiet hours (UTC)",
                        null=True,
                    ),
                ),
                (
                    "quiet_hours_end",
                    models.TimeField(
                        blank=True,
                        help_text="End of quiet hours (UTC)",
                        null=True,
                    ),
                ),
                ("max_emails_per_hour", models.PositiveIntegerField(default=10)),
                ("max_whatsapp_per_hour", models.PositiveIntegerField(default=5)),
                (
                    "category_preferences",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='{"grade_released": true, "assignment_due": true}',
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_preference",
                        to="identity.user",
                    ),
                ),
            ],
            options={
                "db_table": "notification_preferences",
            },
        ),
        migrations.CreateModel(
            name="NotificationQueue",
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
                ("channel", models.CharField(max_length=20)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("processing", "Processing"),
                            ("sent", "Sent"),
                            ("failed", "Failed"),
                            ("retrying", "Retrying"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("normal", "Normal"),
                            ("high", "High"),
                            ("urgent", "Urgent"),
                        ],
                        default="normal",
                        max_length=10,
                    ),
                ),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("max_attempts", models.PositiveIntegerField(default=3)),
                ("last_attempt_at", models.DateTimeField(blank=True, null=True)),
                ("next_retry_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True, default="")),
                ("error_code", models.CharField(blank=True, default="", max_length=50)),
                (
                    "provider_message_id",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                ("provider_response", models.JSONField(blank=True, default=dict)),
                ("rate_limit_key", models.CharField(blank=True, default="", max_length=255)),
                (
                    "notification",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="queue_entries",
                        to="notifications.notification",
                    ),
                ),
            ],
            options={
                "db_table": "notification_queue",
                "ordering": ["-priority", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="NotificationDeliveryLog",
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
                ("action", models.CharField(max_length=50)),
                ("details", models.JSONField(blank=True, default=dict)),
                (
                    "queue_entry",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="delivery_logs",
                        to="notifications.notificationqueue",
                    ),
                ),
            ],
            options={
                "db_table": "notification_delivery_logs",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="notificationqueue",
            index=models.Index(
                fields=["status", "channel", "next_retry_at"],
                name="notif_queue_status_idx",
            ),
        ),
    ]

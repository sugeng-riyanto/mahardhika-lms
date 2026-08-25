import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('consent', '0001_initial'),
    ]

    operations = [
        # Add new fields to ConsentRecord
        migrations.AddField(
            model_name='consentrecord',
            name='consented_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='consent_actions', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='status',
            field=models.CharField(
                choices=[
                    ('granted', 'Granted'),
                    ('withdrawn', 'Withdrawn'),
                    ('expired', 'Expired'),
                    ('pending', 'Pending'),
                ],
                default='pending', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='withdrawal_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='data_categories',
            field=models.JSONField(
                blank=True, default=list,
                help_text='List of personal data categories covered by this consent',
            ),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='processing_purpose',
            field=models.TextField(
                blank=True, default='',
                help_text='Detailed description of how the data will be processed',
            ),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='third_parties',
            field=models.JSONField(
                blank=True, default=list,
                help_text='List of third parties who may receive the data',
            ),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='retention_period_days',
            field=models.PositiveIntegerField(
                blank=True, null=True,
                help_text='How long the data will be retained after consent withdrawal',
            ),
        ),
        migrations.AddField(
            model_name='consentrecord',
            name='lawful_basis',
            field=models.CharField(
                blank=True, default='consent', max_length=50,
                help_text='Legal basis under UU PDP (consent, contract, legal obligation, etc.)',
            ),
        ),
        # Create ConsentAuditLog — use UUID PK to match TimestampedModel
        migrations.CreateModel(
            name='ConsentAuditLog',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('action', models.CharField(
                    choices=[
                        ('granted', 'Consent Granted'),
                        ('withdrawn', 'Consent Withdrawn'),
                        ('modified', 'Consent Modified'),
                        ('expired', 'Consent Expired'),
                        ('accessed', 'Consent Record Accessed'),
                        ('export_requested', 'Data Export Requested'),
                        ('deletion_requested', 'Data Deletion Requested'),
                    ],
                    max_length=30,
                )),
                ('details', models.JSONField(blank=True, default=dict)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True, default='')),
                ('consent', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_logs', to='consent.consentrecord',
                )),
                ('performed_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='consent_audit_actions', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'consent_audit_logs',
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
        # Create DataExportRequest — use UUID PK to match TimestampedModel
        migrations.CreateModel(
            name='DataExportRequest',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('processing', 'Processing'),
                        ('completed', 'Completed'),
                        ('failed', 'Failed'),
                    ],
                    default='pending', max_length=20,
                )),
                ('format', models.CharField(
                    choices=[('json', 'JSON'), ('csv', 'CSV'), ('pdf', 'PDF')],
                    default='json', max_length=10,
                )),
                ('data_categories', models.JSONField(blank=True, default=list)),
                ('download_url', models.URLField(blank=True, default='', max_length=500)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='data_export_requests', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'data_export_requests',
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
        # Create DataDeletionRequest — use UUID PK to match TimestampedModel
        migrations.CreateModel(
            name='DataDeletionRequest',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('processing', 'Processing'),
                        ('completed', 'Completed'),
                        ('denied', 'Denied'),
                        ('partial', 'Partially Completed'),
                    ],
                    default='pending', max_length=20,
                )),
                ('data_categories', models.JSONField(
                    blank=True, default=list,
                    help_text='Which categories of data to delete',
                )),
                ('reason', models.TextField(blank=True, default='')),
                ('denial_reason', models.TextField(blank=True, default='')),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('processed_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='deletion_requests_processed', to=settings.AUTH_USER_MODEL,
                )),
                ('requested_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='deletion_requests_filed', to=settings.AUTH_USER_MODEL,
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='data_deletion_requests', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'data_deletion_requests',
                'ordering': ['-created_at'],
                'abstract': False,
            },
        ),
    ]

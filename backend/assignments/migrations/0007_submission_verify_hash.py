import hashlib

import django.db.models.deletion
from django.db import migrations, models


def backfill_verify_hash(apps, schema_editor):
    AssignmentSubmission = apps.get_model('assignments', 'AssignmentSubmission')
    for sub in AssignmentSubmission.objects.filter(verify_hash__isnull=True):
        payload = (
            f'{sub.assignment_id}|{sub.student_id}|'
            f'{sub.attempt_number}|{sub.created_at.isoformat() if sub.created_at else ""}'
        )
        sub.verify_hash = hashlib.sha256(payload.encode()).hexdigest()[:32]
        sub.save(update_fields=['verify_hash', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0006_question_page'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignmentsubmission',
            name='verify_hash',
            field=models.CharField(
                max_length=64, unique=True, null=True, blank=True, db_index=True,
                help_text='Public verification hash for this submission record',
            ),
        ),
        migrations.RunPython(backfill_verify_hash, migrations.RunPython.noop),
    ]
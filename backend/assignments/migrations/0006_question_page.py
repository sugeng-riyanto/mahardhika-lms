import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0005_alter_assignment_task_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignmentquestion',
            name='page',
            field=models.PositiveIntegerField(default=1, help_text='PDF page number this question appears on (exam tasks)'),
        ),
    ]
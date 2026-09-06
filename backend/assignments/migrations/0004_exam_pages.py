from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0003_task_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='exam_pdf_name',
            field=models.CharField(blank=True, default='', help_text='Original PDF filename for exam tasks', max_length=255),
        ),
        migrations.AddField(
            model_name='assignment',
            name='exam_pages',
            field=models.JSONField(blank=True, default=list, help_text='Rendered page images (data URLs) of the uploaded exam PDF, in page order'),
        ),
    ]
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attempts', '0002_activity_player_v2'),
    ]

    operations = [
        migrations.AddField(
            model_name='attempt',
            name='settings',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

import os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.getcwd())
import django
django.setup()
from django.core.management import call_command
call_command('makemigrations', 'activities', 'attempts', '--name', 'activity_player_enhancements')
print('DONE')

"""
Remove face thumbnails older than N days to protect privacy and save storage.

Usage:
    python manage.py cleanup_old_face_thumbnails
    python manage.py cleanup_old_face_thumbnails --days 7
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from attendance.models import AttendanceRecord


class Command(BaseCommand):
    help = 'Delete face thumbnails from attendance records older than N days (default 30).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=30,
            help='Delete thumbnails older than this many days (default: 30).',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show how many records would be cleaned without actually modifying them.',
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        cutoff = timezone.now() - timedelta(days=days)

        qs = AttendanceRecord.objects.filter(
            face_thumbnail__isnull=False,
        ).exclude(face_thumbnail='').filter(
            created_at__lt=cutoff,
        )

        count = qs.count()

        if dry_run:
            self.stdout.write(
                f'[DRY RUN] Would clear {count} face thumbnails older than {days} days.'
            )
        else:
            updated = qs.update(face_thumbnail='')
            self.stdout.write(
                self.style.SUCCESS(
                    f'Cleared {updated} face thumbnails older than {days} days.'
                )
            )

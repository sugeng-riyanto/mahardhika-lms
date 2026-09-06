"""Send a branded test email through the configured provider to verify delivery.

Usage:
    python manage.py send_test_email --to you@example.com
    python manage.py send_test_email --to you@example.com --template certificate_issued
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.template import Context, Template
from django.template.exceptions import TemplateDoesNotExist
from django.template.loader import render_to_string

from notifications.adapters.email import send_email
from notifications.dispatcher import NOTIFICATION_TEMPLATES, _build_default_html
from notifications.models import EmailTemplate
from notifications.views_templates import SAMPLE_VARS


class Command(BaseCommand):
    help = 'Send a branded test email through the configured email provider.'

    def add_arguments(self, parser):
        parser.add_argument('--to', required=True, help='Recipient email address')
        parser.add_argument(
            '--template', default='grade_released',
            help='Template key to send (default: grade_released)',
        )

    def handle(self, *args, **options):
        to_email = options['to']
        key = options['template']
        tpl = NOTIFICATION_TEMPLATES.get(key)

        if tpl is None:
            raise CommandError(f'Unknown template key "{key}". Choose one of: {", ".join(NOTIFICATION_TEMPLATES)}')

        # Resolve subject + HTML the same way the dispatcher would: DB row,
        # else branded file template, else generic.
        row = EmailTemplate.objects.filter(key=key).first()
        if row:
            subject_raw = row.subject
            body_html_raw = row.body_html
            source = 'db'
        else:
            subject_raw = tpl.get('email_subject') or tpl['title']
            try:
                body_html_raw = render_to_string(f'notifications/{key}.html', SAMPLE_VARS)
                source = 'file'
            except TemplateDoesNotExist:
                body_html_raw = None
                source = 'generic'

        subject = subject_raw
        try:
            subject = subject_raw.format(**SAMPLE_VARS)
        except (KeyError, IndexError):
            pass

        if body_html_raw:
            try:
                html = Template(body_html_raw).render(Context(SAMPLE_VARS))
            except Exception:
                html = body_html_raw
        else:
            html = _build_default_html(tpl['title'], 'Sample notification message.', 'Sample Student')

        self.stdout.write(self.style.WARNING(
            f'Provider: {settings.EMAIL_PROVIDER} | host: {settings.EMAIL_HOST or "(unset)"} | '
            f'from: {settings.DEFAULT_FROM_EMAIL} | template: {key} ({source})'
        ))

        result = send_email(
            to_email=to_email,
            subject=subject,
            body=f'Test email for template "{key}".',
            html_body=html,
        )

        if result.success:
            self.stdout.write(self.style.SUCCESS(
                f'Email sent to {to_email} via {result.provider} (id={result.message_id}). '
                'Check the inbox (and spam folder).'
            ))
        else:
            raise CommandError(
                f'Email delivery FAILED via {result.provider}: {result.error}. '
                'Check the EMAIL_* env vars (see docs/EMAIL_SETUP.md).'
            )
"""
Tests for email adapter, WhatsApp adapter, and notification dispatcher.
"""
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.utils import timezone

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from notifications.models import Notification
from notifications.adapters.email import (
    MockEmailProvider, SMTPEmailProvider, EmailMessage, send_email,
)
from notifications.adapters.whatsapp import (
    MockWhatsAppProvider, WACloudAPIProvider, WhatsAppMessage, send_whatsapp,
)
from notifications.dispatcher import (
    dispatch_notification, NOTIFICATION_TEMPLATES,
)


class EmailAdapterTest(TestCase):
    """Test the email adapter."""

    def setUp(self):
        self.provider = MockEmailProvider()

    def test_mock_send_success(self):
        msg = EmailMessage(
            to_email='test@example.com',
            subject='Test Subject',
            body='Hello World',
        )
        result = self.provider.send(msg)
        self.assertTrue(result.success)
        self.assertEqual(result.provider, 'mock')
        self.assertTrue(result.message_id.startswith('mock-email-'))

    def test_mock_stores_sent_email(self):
        msg = EmailMessage(
            to_email='test@example.com',
            subject='Test Subject',
            body='Hello World',
            html_body='<h1>Hello</h1>',
            metadata={'test': True},
        )
        self.provider.send(msg)
        sent = self.provider.get_sent_emails()
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]['to'], 'test@example.com')
        self.assertEqual(sent[0]['subject'], 'Test Subject')
        self.assertEqual(sent[0]['body'], 'Hello World')
        self.assertIn('Hello', sent[0]['html_body'])

    def test_mock_clear(self):
        msg = EmailMessage(to_email='test@example.com', subject='Test', body='Test')
        self.provider.send(msg)
        self.assertEqual(len(self.provider.get_sent_emails()), 1)
        self.provider.clear()
        self.assertEqual(len(self.provider.get_sent_emails()), 0)

    def test_send_email_convenience(self):
        result = send_email(
            to_email='user@test.com',
            subject='Convenience Test',
            body='This is a test',
        )
        self.assertTrue(result.success)

    @override_settings(
        EMAIL_PROVIDER='mock',
        EMAIL_HOST='localhost',
        EMAIL_PORT=587,
    )
    def test_get_email_provider_returns_mock(self):
        from notifications.adapters.email import get_email_provider
        provider = get_email_provider()
        self.assertIsInstance(provider, MockEmailProvider)

    def test_smtp_send_connection_error(self):
        """SMTP provider returns failure on connection error."""
        provider = SMTPEmailProvider()
        msg = EmailMessage(
            to_email='test@example.com',
            subject='Test',
            body='Test',
        )
        result = provider.send(msg)
        # Will fail because no SMTP server is running
        self.assertFalse(result.success)
        self.assertEqual(result.provider, 'smtp')
        self.assertIn('error', result.error.lower()) or self.assertTrue(len(result.error) > 0)


class WhatsAppAdapterTest(TestCase):
    """Test the WhatsApp adapter."""

    def setUp(self):
        self.provider = MockWhatsAppProvider()

    def test_mock_send_success(self):
        msg = WhatsAppMessage(
            to_phone='+628123456789',
            body='Hello from AKADEMI',
        )
        result = self.provider.send(msg)
        self.assertTrue(result.success)
        self.assertEqual(result.provider, 'mock')
        self.assertTrue(result.message_id.startswith('mock-wa-'))

    def test_mock_stores_sent_message(self):
        msg = WhatsAppMessage(
            to_phone='+628123456789',
            body='Test message',
            template_name='welcome',
            template_vars={'name': 'Student'},
            metadata={'test': True},
        )
        self.provider.send(msg)
        sent = self.provider.get_sent_messages()
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]['to'], '+628123456789')
        self.assertEqual(sent[0]['template_name'], 'welcome')

    def test_mock_clear(self):
        msg = WhatsAppMessage(to_phone='+628123456789', body='Test')
        self.provider.send(msg)
        self.assertEqual(len(self.provider.get_sent_messages()), 1)
        self.provider.clear()
        self.assertEqual(len(self.provider.get_sent_messages()), 0)

    def test_send_whatsapp_convenience(self):
        result = send_whatsapp(
            to_phone='+628123456789',
            body='Convenience test',
        )
        self.assertTrue(result.success)

    def test_wa_cloud_api_missing_credentials(self):
        """Cloud API provider fails gracefully without credentials."""
        provider = WACloudAPIProvider()
        msg = WhatsAppMessage(to_phone='+628123456789', body='Test')
        result = provider.send(msg)
        self.assertFalse(result.success)
        self.assertIn('WHATSAPP_API_TOKEN', result.error)


class DispatcherTest(TestCase):
    """Test the notification dispatcher."""

    def setUp(self):
        self.org = Organisation.objects.create(name='Test Org', slug='test-dispatch')
        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.admin = User.objects.create_user(
            email='admin@dispatch.test', password='pass',
            supabase_uid='uid-dispatch-admin', full_name='Admin',
        )
        self.student = User.objects.create_user(
            email='student@dispatch.test', password='pass',
            supabase_uid='uid-dispatch-student', full_name='Student',
        )

        for user, role in [(self.admin, self.admin_role), (self.student, self.student_role)]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

    def test_dispatch_in_app_only(self):
        results = dispatch_notification(
            recipient=self.student,
            title='Test Notification',
            message='This is a test.',
            channels=['in_app'],
        )
        self.assertIn('in_app', results)
        self.assertTrue(results['in_app']['success'])
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.student, title='Test Notification',
            ).exists()
        )

    def test_dispatch_in_app_and_email(self):
        results = dispatch_notification(
            recipient=self.student,
            title='Multi Channel',
            message='Testing multi-channel.',
            channels=['in_app', 'email'],
        )
        self.assertIn('in_app', results)
        self.assertIn('email', results)
        self.assertTrue(results['in_app']['success'])
        self.assertTrue(results['email']['success'])

    def test_dispatch_with_template(self):
        results = dispatch_notification(
            recipient=self.student,
            title='',
            message='',
            channels=['in_app'],
            template_key='grade_released',
            template_vars={
                'course_name': 'Physics 10',
                'score': '85',
                'max_score': '100',
            },
        )
        self.assertTrue(results['in_app']['success'])
        notif = Notification.objects.filter(
            recipient=self.student, title='Grade Released',
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn('Physics 10', notif.message)

    def test_dispatch_whatsapp_no_phone(self):
        """WhatsApp dispatch fails gracefully without phone number."""
        from notifications.models import NotificationPreference
        NotificationPreference.objects.create(
            user=self.student, whatsapp_enabled=True,
        )
        results = dispatch_notification(
            recipient=self.student,
            title='Test',
            message='Test message',
            channels=['whatsapp'],
        )
        self.assertIn('whatsapp', results)
        self.assertFalse(results['whatsapp']['success'])
        self.assertIn('phone', results['whatsapp']['error'].lower())

    def test_dispatch_all_channels(self):
        results = dispatch_notification(
            recipient=self.student,
            title='All Channels',
            message='Testing all channels.',
            channels=['in_app', 'email', 'whatsapp'],
        )
        self.assertIn('in_app', results)
        self.assertIn('email', results)
        self.assertIn('whatsapp', results)
        self.assertTrue(results['in_app']['success'])
        self.assertTrue(results['email']['success'])

    def test_notification_templates_exist(self):
        """All expected templates are defined."""
        expected = [
            'grade_released', 'assignment_due', 'submission_received',
            'feedback_available', 'course_enrolled', 'certificate_issued',
            'invoice_created', 'payment_confirmed', 'canvas_returned',
            'parent_child_update',
        ]
        for key in expected:
            self.assertIn(key, NOTIFICATION_TEMPLATES)
            tpl = NOTIFICATION_TEMPLATES[key]
            self.assertIn('title', tpl)
            self.assertIn('message_template', tpl)

    def test_dispatch_with_metadata(self):
        results = dispatch_notification(
            recipient=self.student,
            title='Metadata Test',
            message='Test',
            channels=['in_app'],
            metadata={'course_id': '123', 'action': 'grade_released'},
        )
        notif = Notification.objects.get(recipient=self.student, title='Metadata Test')
        self.assertEqual(notif.metadata['course_id'], '123')
        self.assertEqual(notif.metadata['action'], 'grade_released')

"""
Tests for notification preferences, queue, and delivery log.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from notifications.models import (
    Notification, NotificationPreference, NotificationQueue, NotificationDeliveryLog,
)


class PreferencesTestBase(TestCase):
    """Shared setup for preferences tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Pref Org', slug='pref-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.admin = User.objects.create_user(
            email='admin@pref.test', password='pass',
            supabase_uid='uid-pref-admin', full_name='Admin',
        )
        self.student = User.objects.create_user(
            email='student@pref.test', password='pass',
            supabase_uid='uid-pref-student', full_name='Student',
        )

        for user, role in [(self.admin, self.admin_role), (self.student, self.student_role)]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class NotificationPreferencesAPITest(PreferencesTestBase):
    """Test the preferences API endpoint."""

    def test_get_creates_defaults(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/notifications/preferences/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['in_app_enabled'])
        self.assertTrue(res.data['email_enabled'])
        self.assertFalse(res.data['whatsapp_enabled'])

    def test_update_email_enabled(self):
        self.auth(self.student)
        res = self.client.patch('/api/v1/notifications/preferences/', {
            'email_enabled': False,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['email_enabled'])

    def test_update_quiet_hours(self):
        self.auth(self.student)
        res = self.client.patch('/api/v1/notifications/preferences/', {
            'quiet_hours_start': '22:00:00',
            'quiet_hours_end': '07:00:00',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['quiet_hours_start'], '22:00:00')

    def test_update_category_preferences(self):
        self.auth(self.student)
        res = self.client.patch('/api/v1/notifications/preferences/', {
            'category_preferences': {
                'grade_released': True,
                'assignment_due': False,
            },
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['category_preferences']['grade_released'])
        self.assertFalse(res.data['category_preferences']['assignment_due'])

    def test_update_frequency_limits(self):
        self.auth(self.student)
        res = self.client.patch('/api/v1/notifications/preferences/', {
            'max_emails_per_hour': 5,
            'max_whatsapp_per_hour': 2,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['max_emails_per_hour'], 5)

    def test_put_replaces_all(self):
        self.auth(self.student)
        res = self.client.put('/api/v1/notifications/preferences/', {
            'email_enabled': True,
            'whatsapp_enabled': True,
            'in_app_enabled': True,
            'quiet_hours_start': '23:00:00',
            'quiet_hours_end': '06:00:00',
            'max_emails_per_hour': 3,
            'max_whatsapp_per_hour': 1,
            'category_preferences': {'grade_released': True},
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['whatsapp_enabled'])
        self.assertEqual(res.data['max_emails_per_hour'], 3)


class NotificationPreferenceModelTest(TestCase):
    """Test the preference model methods."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='model@test.com', password='pass', supabase_uid='uid-model',
        )
        self.pref = NotificationPreference.objects.create(user=self.user)

    def test_is_channel_enabled_in_app(self):
        self.assertTrue(self.pref.is_channel_enabled('in_app'))
        self.pref.in_app_enabled = False
        self.pref.save()
        self.assertFalse(self.pref.is_channel_enabled('in_app'))

    def test_is_channel_enabled_email(self):
        self.assertTrue(self.pref.is_channel_enabled('email'))
        self.pref.email_enabled = False
        self.pref.save()
        self.assertFalse(self.pref.is_channel_enabled('email'))

    def test_is_channel_enabled_whatsapp(self):
        self.assertFalse(self.pref.is_channel_enabled('whatsapp'))
        self.pref.whatsapp_enabled = True
        self.pref.save()
        self.assertTrue(self.pref.is_channel_enabled('whatsapp'))

    def test_is_quiet_hours_no_config(self):
        self.assertFalse(self.pref.is_quiet_hours())

    def test_is_category_enabled_default(self):
        self.assertTrue(self.pref.is_category_enabled('grade_released'))

    def test_is_category_enabled_disabled(self):
        self.pref.category_preferences = {'grade_released': False}
        self.pref.save()
        self.assertFalse(self.pref.is_category_enabled('grade_released'))


class NotificationQueueTest(TestCase):
    """Test the queue model methods."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='queue@test.com', password='pass', supabase_uid='uid-queue',
        )
        self.notif = Notification.objects.create(
            recipient=self.user, channel='email',
            title='Test', message='Test message',
        )
        self.queue = NotificationQueue.objects.create(
            notification=self.notif, channel='email',
        )

    def test_mark_sent(self):
        self.queue.mark_sent(provider_message_id='msg-123')
        self.assertEqual(self.queue.status, 'sent')
        self.assertIsNotNone(self.queue.delivered_at)
        self.assertEqual(self.queue.provider_message_id, 'msg-123')

    def test_mark_failed_under_max(self):
        self.queue.mark_failed('Connection timeout')
        self.assertEqual(self.queue.status, 'retrying')
        self.assertEqual(self.queue.attempts, 1)
        self.assertIsNotNone(self.queue.next_retry_at)

    def test_mark_failed_at_max(self):
        self.queue.attempts = 2
        self.queue.max_attempts = 3
        self.queue.mark_failed('Final failure')
        self.assertEqual(self.queue.status, 'failed')
        self.assertEqual(self.queue.attempts, 3)

    def test_mark_processing(self):
        self.queue.mark_processing()
        self.assertEqual(self.queue.status, 'processing')
        self.assertIsNotNone(self.queue.last_attempt_at)

    def test_cancel(self):
        self.queue.cancel()
        self.assertEqual(self.queue.status, 'cancelled')

    def test_delivery_log_created(self):
        log = NotificationDeliveryLog.objects.create(
            queue_entry=self.queue, action='queued',
            details={'reason': 'test'},
        )
        self.assertEqual(log.action, 'queued')
        self.assertEqual(log.queue_entry, self.queue)


class DispatcherPreferencesIntegrationTest(TestCase):
    """Test that dispatcher respects user preferences."""

    def setUp(self):
        self.org = Organisation.objects.create(name='Disp Pref Org', slug='disp-pref-org')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.student = User.objects.create_user(
            email='student@disp-pref.test', password='pass',
            supabase_uid='uid-disp-pref-student',
        )
        RoleAssignment.objects.create(
            user=self.student, role=self.student_role,
            organisation=self.org, status='active',
            valid_from=timezone.now(),
        )

    def test_email_disabled_not_sent(self):
        NotificationPreference.objects.create(
            user=self.student, email_enabled=False,
        )
        from notifications.dispatcher import dispatch_notification
        results = dispatch_notification(
            recipient=self.student,
            title='Test', message='Test',
            channels=['email'],
        )
        self.assertFalse(results['email']['success'])
        self.assertIn('disabled', results['email']['error'])

    def test_whatsapp_disabled_not_sent(self):
        NotificationPreference.objects.create(
            user=self.student, whatsapp_enabled=False,
        )
        from notifications.dispatcher import dispatch_notification
        results = dispatch_notification(
            recipient=self.student,
            title='Test', message='Test',
            channels=['whatsapp'],
        )
        self.assertFalse(results['whatsapp']['success'])
        self.assertIn('disabled', results['whatsapp']['error'])

    def test_quiet_hours_queues_email(self):
        from notifications.dispatcher import dispatch_notification
        # Create preferences with quiet hours covering now
        now = timezone.now().time()
        NotificationPreference.objects.create(
            user=self.student,
            quiet_hours_start=now.replace(hour=max(0, now.hour - 1)),
            quiet_hours_end=now.replace(hour=(now.hour + 2) % 24),
        )
        results = dispatch_notification(
            recipient=self.student,
            title='Test', message='Test',
            channels=['email'],
        )
        self.assertTrue(results['email']['success'])
        self.assertTrue(results['email'].get('queued'))
        # Verify queue entry exists
        self.assertTrue(
            NotificationQueue.objects.filter(
                notification__recipient=self.student,
                channel='email',
                status='pending',
            ).exists()
        )

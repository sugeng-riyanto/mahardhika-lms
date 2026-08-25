"""
Tests for notification RBAC, mark_read, mark_all_read, unread_count.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from notifications.models import Notification


class NotificationTestBase(TestCase):
    """Shared setup for notification tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Notif Org', slug='notif-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.admin = User.objects.create_user(
            email='admin@notif.test', password='pass123',
            supabase_uid='admin-notif-uid', full_name='Admin',
        )
        self.student = User.objects.create_user(
            email='student@notif.test', password='pass123',
            supabase_uid='student-notif-uid', full_name='Student',
        )

        for user, role in [(self.admin, self.admin_role), (self.student, self.student_role)]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

        # Create notifications for student
        self.notif1 = Notification.objects.create(
            recipient=self.student,
            channel='in_app', title='Grade Released', message='Your essay grade is available.',
        )
        self.notif2 = Notification.objects.create(
            recipient=self.student,
            channel='in_app', title='Assignment Due', message='Assignment 1 is due tomorrow.',
            is_read=True, read_at=timezone.now(),
        )
        self.notif3 = Notification.objects.create(
            recipient=self.admin,
            channel='in_app', title='System Alert', message='Database backup complete.',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class NotificationListTests(NotificationTestBase):
    """Test listing and filtering notifications."""

    def test_student_sees_own_notifications(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/notifications/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 2)

    def test_student_does_not_see_admin_notifications(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/notifications/')
        results = res.data.get('results', res.data)
        ids = [n['id'] for n in results]
        self.assertNotIn(str(self.notif3.id), ids)

    def test_filter_unread(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/notifications/', {'is_read': 'false'})
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)

    def test_filter_read(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/notifications/', {'is_read': 'true'})
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)


class UnreadCountTests(NotificationTestBase):
    """Test unread count endpoint."""

    def test_unread_count(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/notifications/unread_count/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 1)

    def test_admin_unread_count(self):
        self.auth(self.admin)
        res = self.client.get('/api/v1/notifications/unread_count/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 1)


class MarkReadTests(NotificationTestBase):
    """Test mark_read and mark_all_read."""

    def test_mark_single_read(self):
        self.auth(self.student)
        res = self.client.post(f'/api/v1/notifications/{self.notif1.id}/mark_read/')
        self.assertEqual(res.status_code, 200)
        self.notif1.refresh_from_db()
        self.assertTrue(self.notif1.is_read)
        self.assertIsNotNone(self.notif1.read_at)

    def test_mark_all_read(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/notifications/mark_all_read/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['marked_read'], 1)

    def test_cannot_mark_others_read(self):
        self.auth(self.student)
        res = self.client.post(f'/api/v1/notifications/{self.notif3.id}/mark_read/')
        self.assertIn(res.status_code, [403, 404])


class AdminCreateNotificationTests(NotificationTestBase):
    """Test admin creating notifications for users."""

    def test_admin_can_create(self):
        self.auth(self.admin)
        res = self.client.post('/api/v1/notifications/send/', {
            'recipient': str(self.student.id),
            'title': 'Welcome',
            'message': 'Welcome to AKADEMI!',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.student, title='Welcome',
            ).exists()
        )

    def test_student_cannot_create_for_others(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/notifications/send/', {
            'recipient': str(self.admin.id),
            'title': 'Hack',
            'message': 'test',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_missing_fields(self):
        self.auth(self.admin)
        res = self.client.post('/api/v1/notifications/send/', {
            'title': 'No recipient',
        }, format='json')
        self.assertEqual(res.status_code, 400)

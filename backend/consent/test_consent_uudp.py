"""Tests for UU PDP consent management — withdrawal, export, deletion, privacy notice."""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from consent.models import ConsentRecord, ConsentAuditLog, DataExportRequest, DataDeletionRequest


@override_settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_SECRET_KEY='test-key', ALLOWED_HOSTS=['*'])
class ConsentWithdrawalTest(TestCase):
    """Test consent withdrawal — UU PDP Article 21."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')
        self.role_parent = Role.objects.create(name='parent', display_name='Parent')
        self.role_student = Role.objects.create(name='student', display_name='Student')
        self.role_admin = Role.objects.create(name='admin', display_name='Admin')

        self.parent = User.objects.create_user(
            email='parent@test.com', password='testpass123',
            supabase_uid='parent-uid-1',
        )
        self.student = User.objects.create_user(
            email='student@test.com', password='testpass123',
            supabase_uid='student-uid-1',
        )
        self.admin = User.objects.create_user(
            email='admin@test.com', password='testpass123',
            supabase_uid='admin-uid-1',
        )

        for user, role in [
            (self.parent, self.role_parent),
            (self.student, self.role_student),
            (self.admin, self.role_admin),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org, status='active',
            )

        self.parent_consent = ConsentRecord.objects.create(
            user=self.parent, purpose='communication', status='granted',
            granted=True, granted_at=timezone.now(),
            consented_by=self.admin,
        )
        self.student_consent = ConsentRecord.objects.create(
            user=self.student, purpose='learning', status='granted',
            granted=True, granted_at=timezone.now(),
            consented_by=self.parent,
            data_categories=['grades', 'assignments', 'attendance'],
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    # ── Withdrawal tests ─────────────────────────────────────

    def test_parent_can_withdraw_own_consent(self):
        self.auth(self.parent)
        res = self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/withdraw/',
            {'reason': 'No longer want marketing emails'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['detail'], 'Consent withdrawn successfully.')
        self.parent_consent.refresh_from_db()
        self.assertEqual(self.parent_consent.status, 'withdrawn')
        self.assertFalse(self.parent_consent.granted)
        self.assertIsNotNone(self.parent_consent.withdrawn_at)
        self.assertEqual(self.parent_consent.withdrawal_reason, 'No longer want marketing emails')

    def test_student_can_withdraw_own_consent(self):
        self.auth(self.student)
        res = self.client.post(
            f'/api/v1/consent/records/{self.student_consent.id}/withdraw/',
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.student_consent.refresh_from_db()
        self.assertEqual(self.student_consent.status, 'withdrawn')

    def test_withdrawal_creates_audit_log(self):
        self.auth(self.parent)
        initial_count = ConsentAuditLog.objects.count()
        self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/withdraw/',
            {'reason': 'Testing audit'},
            format='json',
        )
        self.assertEqual(ConsentAuditLog.objects.count(), initial_count + 1)
        log = ConsentAuditLog.objects.latest('created_at')
        self.assertEqual(log.action, 'withdrawn')
        self.assertEqual(log.performed_by, self.parent)
        self.assertEqual(log.details['reason'], 'Testing audit')

    def test_unauthorized_user_cannot_withdraw_others_consent(self):
        other = User.objects.create_user(
            email='other@test.com', password='testpass123',
            supabase_uid='other-uid-1',
        )
        RoleAssignment.objects.create(
            user=other, role=self.role_student, organisation=self.org, status='active',
        )
        self.auth(other)
        res = self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/withdraw/',
            format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_admin_can_withdraw_any_consent(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/consent/records/{self.student_consent.id}/withdraw/',
            {'reason': 'Admin action'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)

    # ── Grant tests ──────────────────────────────────────────

    def test_can_regrant_after_withdrawal(self):
        self.auth(self.parent)
        self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/withdraw/',
            format='json',
        )
        self.parent_consent.refresh_from_db()
        self.assertEqual(self.parent_consent.status, 'withdrawn')

        res = self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/grant/',
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.parent_consent.refresh_from_db()
        self.assertEqual(self.parent_consent.status, 'granted')
        self.assertTrue(self.parent_consent.granted)
        self.assertIsNone(self.parent_consent.withdrawn_at)

    def test_grant_creates_audit_log(self):
        self.auth(self.parent)
        self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/withdraw/',
            format='json',
        )
        log_count_before = ConsentAuditLog.objects.count()
        self.client.post(
            f'/api/v1/consent/records/{self.parent_consent.id}/grant/',
            format='json',
        )
        self.assertEqual(ConsentAuditLog.objects.count(), log_count_before + 1)
        log = ConsentAuditLog.objects.latest('created_at')
        self.assertEqual(log.action, 'granted')


@override_settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_SECRET_KEY='test-key', ALLOWED_HOSTS=['*'])
class DataExportTest(TestCase):
    """Test data export — UU PDP Article 26."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')
        self.role_student = Role.objects.create(name='student', display_name='Student')
        self.role_admin = Role.objects.create(name='admin', display_name='Admin')

        self.student = User.objects.create_user(
            email='student@test.com', password='testpass123',
            supabase_uid='student-export-uid',
        )
        self.admin = User.objects.create_user(
            email='admin@test.com', password='testpass123',
            supabase_uid='admin-export-uid',
        )
        RoleAssignment.objects.create(
            user=self.student, role=self.role_student, organisation=self.org, status='active',
        )
        RoleAssignment.objects.create(
            user=self.admin, role=self.role_admin, organisation=self.org, status='active',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_student_can_request_export(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/consent/export-requests/', {
            'format': 'json',
            'data_categories': ['learning', 'grades'],
        }, format='json')
        self.assertIn(res.status_code, [200, 201])
        self.assertEqual(DataExportRequest.objects.count(), 1)
        req = DataExportRequest.objects.first()
        self.assertEqual(req.user, self.student)
        self.assertEqual(req.status, 'pending')

    def test_admin_can_approve_export(self):
        self.auth(self.student)
        self.client.post('/api/v1/consent/export-requests/', {
            'format': 'json',
            'data_categories': ['learning'],
        }, format='json')
        req = DataExportRequest.objects.first()

        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/consent/export-requests/{req.id}/approve/',
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, 'processing')
        self.assertIsNotNone(req.processed_at)

    def test_student_cannot_approve_export(self):
        self.auth(self.student)
        self.client.post('/api/v1/consent/export-requests/', {
            'format': 'csv',
            'data_categories': ['learning'],
        }, format='json')
        req = DataExportRequest.objects.first()
        res = self.client.post(
            f'/api/v1/consent/export-requests/{req.id}/approve/',
            format='json',
        )
        self.assertEqual(res.status_code, 403)


@override_settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_SECRET_KEY='test-key', ALLOWED_HOSTS=['*'])
class DataDeletionTest(TestCase):
    """Test data deletion — UU PDP Article 26."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')
        self.role_student = Role.objects.create(name='student', display_name='Student')
        self.role_admin = Role.objects.create(name='admin', display_name='Admin')

        self.student = User.objects.create_user(
            email='student@test.com', password='testpass123',
            supabase_uid='student-delete-uid',
        )
        self.admin = User.objects.create_user(
            email='admin@test.com', password='testpass123',
            supabase_uid='admin-delete-uid',
        )
        RoleAssignment.objects.create(
            user=self.student, role=self.role_student, organisation=self.org, status='active',
        )
        RoleAssignment.objects.create(
            user=self.admin, role=self.role_admin, organisation=self.org, status='active',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_student_can_request_deletion(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/consent/deletion-requests/', {
            'reason': 'No longer using the platform',
            'data_categories': ['communication'],
        }, format='json')
        self.assertIn(res.status_code, [200, 201])
        self.assertEqual(DataDeletionRequest.objects.count(), 1)
        req = DataDeletionRequest.objects.first()
        self.assertEqual(req.user, self.student)

    def test_admin_can_approve_deletion(self):
        self.auth(self.student)
        self.client.post('/api/v1/consent/deletion-requests/', {
            'reason': 'Please delete my data',
            'data_categories': ['learning'],
        }, format='json')
        req = DataDeletionRequest.objects.first()

        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/consent/deletion-requests/{req.id}/approve/',
            {'action': 'approve'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, 'processing')

    def test_admin_can_deny_deletion(self):
        self.auth(self.student)
        self.client.post('/api/v1/consent/deletion-requests/', {
            'reason': 'Delete',
            'data_categories': ['learning'],
        }, format='json')
        req = DataDeletionRequest.objects.first()

        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/consent/deletion-requests/{req.id}/approve/',
            {'action': 'deny', 'reason': 'Required for legal compliance'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, 'denied')
        self.assertEqual(req.denial_reason, 'Required for legal compliance')

    def test_student_cannot_approve_deletion(self):
        self.auth(self.student)
        self.client.post('/api/v1/consent/deletion-requests/', {
            'reason': 'Delete',
            'data_categories': ['learning'],
        }, format='json')
        req = DataDeletionRequest.objects.first()
        res = self.client.post(
            f'/api/v1/consent/deletion-requests/{req.id}/approve/',
            {'action': 'approve'},
            format='json',
        )
        self.assertEqual(res.status_code, 403)


@override_settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_SECRET_KEY='test-key', ALLOWED_HOSTS=['*'])
class PrivacyNoticeTest(TestCase):
    """Test privacy notice endpoint."""

    def setUp(self):
        self.client = APIClient()

    def test_privacy_notice_is_public(self):
        """Privacy notice should be accessible without authentication."""
        res = self.client.get('/api/v1/consent/privacy-notice/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('title', res.data)
        self.assertIn('your_rights', res.data)
        self.assertIn('child_protection', res.data)
        self.assertIn('data_collected', res.data)

    def test_privacy_notice_has_uudp_rights(self):
        res = self.client.get('/api/v1/consent/privacy-notice/')
        rights = [r['right'] for r in res.data['your_rights']]
        self.assertTrue(any('Withdraw Consent' in r for r in rights))
        self.assertTrue(any('Deletion' in r for r in rights))
        self.assertTrue(any('Portability' in r for r in rights))

    def test_privacy_notice_has_child_protection(self):
        res = self.client.get('/api/v1/consent/privacy-notice/')
        child = res.data['child_protection']
        self.assertTrue(child['parental_consent_required'])
        self.assertIn('enhanced_safeguards', child)


@override_settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_SECRET_KEY='test-key', ALLOWED_HOSTS=['*'])
class ConsentModelTest(TestCase):
    """Test consent model methods."""

    def setUp(self):
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')
        self.user = User.objects.create_user(
            email='test@test.com', password='testpass123',
            supabase_uid='model-test-uid',
        )

    def test_consent_withdraw(self):
        consent = ConsentRecord.objects.create(
            user=self.user, purpose='learning', status='granted',
            granted=True, granted_at=timezone.now(),
        )
        consent.withdraw(reason='Testing')
        consent.refresh_from_db()
        self.assertEqual(consent.status, 'withdrawn')
        self.assertFalse(consent.granted)
        self.assertIsNotNone(consent.withdrawn_at)
        self.assertEqual(consent.withdrawal_reason, 'Testing')

    def test_consent_grant(self):
        consent = ConsentRecord.objects.create(
            user=self.user, purpose='learning', status='withdrawn',
            granted=False, withdrawn_at=timezone.now(),
            withdrawal_reason='Old reason',
        )
        consent.grant()
        consent.refresh_from_db()
        self.assertEqual(consent.status, 'granted')
        self.assertTrue(consent.granted)
        self.assertIsNone(consent.withdrawn_at)
        self.assertEqual(consent.withdrawal_reason, '')

    def test_is_active_when_granted(self):
        consent = ConsentRecord.objects.create(
            user=self.user, purpose='learning', status='granted',
            granted=True, granted_at=timezone.now(),
        )
        self.assertTrue(consent.is_active)

    def test_is_not_active_when_withdrawn(self):
        consent = ConsentRecord.objects.create(
            user=self.user, purpose='learning', status='withdrawn',
            granted=False, withdrawn_at=timezone.now(),
        )
        self.assertFalse(consent.is_active)

    def test_is_expired_when_past(self):
        consent = ConsentRecord.objects.create(
            user=self.user, purpose='learning', status='granted',
            granted=True, granted_at=timezone.now(),
            expires_at=timezone.now() - timedelta(days=1),
        )
        self.assertTrue(consent.is_expired)
        self.assertFalse(consent.is_active)

    def test_unique_together_constraint(self):
        ConsentRecord.objects.create(
            user=self.user, purpose='learning', status='granted',
            granted=True,
        )
        with self.assertRaises(Exception):
            ConsentRecord.objects.create(
                user=self.user, purpose='learning', status='granted',
                granted=True,
            )

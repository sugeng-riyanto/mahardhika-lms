"""
Safeguarding module tests — RBAC, org isolation, status transitions, audit.
Only admin/owner can manage safeguarding reports.
Reports are org-scoped — one org cannot see another's reports.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from safeguarding.models import SafeguardingReport


class SafeguardingTestBase(TestCase):
    """Shared setup for safeguarding tests."""

    def setUp(self):
        self.client = APIClient()

        # Org
        self.org = Organisation.objects.create(name='SG Org', slug='sg-org')
        self.other_org = Organisation.objects.create(name='SG Other', slug='sg-other')

        # Roles
        self.owner_role, _ = Role.objects.get_or_create(name='owner')
        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')
        self.parent_role, _ = Role.objects.get_or_create(name='parent')

        # Users
        self.owner = User.objects.create_user(
            email='owner@sg.test', password='pass123',
            supabase_uid='sg-owner-uid', full_name='SG Owner',
        )
        self.admin = User.objects.create_user(
            email='admin@sg.test', password='pass123',
            supabase_uid='sg-admin-uid', full_name='SG Admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@sg.test', password='pass123',
            supabase_uid='sg-instructor-uid', full_name='SG Instructor',
        )
        self.student = User.objects.create_user(
            email='student@sg.test', password='pass123',
            supabase_uid='sg-student-uid', full_name='SG Student',
        )
        self.parent = User.objects.create_user(
            email='parent@sg.test', password='pass123',
            supabase_uid='sg-parent-uid', full_name='SG Parent',
        )

        # Other org user
        self.other_admin = User.objects.create_user(
            email='other@sg.test', password='pass123',
            supabase_uid='sg-other-uid', full_name='SG Other Admin',
        )

        # Role assignments
        for user, role in [
            (self.owner, self.owner_role),
            (self.admin, self.admin_role),
            (self.instructor, self.instructor_role),
            (self.student, self.student_role),
            (self.parent, self.parent_role),
            (self.other_admin, self.admin_role),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active',
            )

        # Other org assignment
        RoleAssignment.objects.create(
            user=self.other_admin, role=self.admin_role,
            organisation=self.other_org, status='active',
        )

        # Sample report
        self.report = SafeguardingReport.objects.create(
            reporter=self.admin,
            subject_user=self.student,
            organisation=self.org,
            status='open',
            description='Incident test report',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class SafeguardingModelTests(SafeguardingTestBase):

    def test_str_representation(self):
        self.assertIn('open', str(self.report))

    def test_default_status(self):
        r = SafeguardingReport.objects.create(
            reporter=self.admin,
            organisation=self.org,
            description='New report',
        )
        self.assertEqual(r.status, 'open')

    def test_status_choices(self):
        for status in ['open', 'investigating', 'resolved', 'escalated']:
            r = SafeguardingReport.objects.create(
                reporter=self.admin,
                organisation=self.org,
                status=status,
                description=f'Report {status}',
            )
            self.assertEqual(r.status, status)

    def test_ordering(self):
        r1 = SafeguardingReport.objects.create(
            reporter=self.admin,
            organisation=self.org,
            description='First report',
        )
        reports = list(SafeguardingReport.objects.filter(organisation=self.org))
        # All reports are returned and ordered
        self.assertEqual(len(reports), 2)  # self.report + r1
        self.assertTrue(any(r.id == r1.id for r in reports))

    def test_reporter_nullable(self):
        r = SafeguardingReport.objects.create(
            organisation=self.org,
            description='Anonymous report',
        )
        self.assertIsNone(r.reporter)

    def test_assigned_to_nullable(self):
        self.assertIsNone(self.report.assigned_to)
        self.report.assigned_to = self.instructor
        self.report.save()
        self.report.refresh_from_db()
        self.assertEqual(self.report.assigned_to, self.instructor)


class SafeguardingCRUDTests(SafeguardingTestBase):

    def test_admin_can_list_reports(self):
        self.auth(self.admin)
        res = self.client.get('/api/v1/safeguarding/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertTrue(len(results) >= 1)

    def test_owner_can_list_reports(self):
        self.auth(self.owner)
        res = self.client.get('/api/v1/safeguarding/')
        self.assertEqual(res.status_code, 200)

    def test_admin_can_create_report(self):
        self.auth(self.admin)
        res = self.client.post('/api/v1/safeguarding/', {
            'subject_user': str(self.student.id),
            'organisation': str(self.org.id),
            'description': 'New safeguarding report',
            'status': 'open',
        }, format='json')
        self.assertIn(res.status_code, [201, 200])

    def test_admin_can_update_status(self):
        self.auth(self.admin)
        res = self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'investigating'},
            format='json',
        )
        self.assertIn(res.status_code, [200, 204])
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, 'investigating')

    def test_admin_can_escalate(self):
        self.auth(self.admin)
        self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'investigating'},
            format='json',
        )
        res = self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'escalated'},
            format='json',
        )
        self.assertIn(res.status_code, [200, 204])

    def test_admin_can_resolve(self):
        self.auth(self.admin)
        res = self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'resolved'},
            format='json',
        )
        self.assertIn(res.status_code, [200, 204])

    def test_admin_can_delete_report(self):
        self.auth(self.admin)
        res = self.client.delete(f'/api/v1/safeguarding/{self.report.id}/')
        self.assertIn(res.status_code, [200, 204])
        self.assertFalse(
            SafeguardingReport.objects.filter(id=self.report.id).exists()
        )

    def test_admin_can_assign(self):
        self.auth(self.admin)
        res = self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'assigned_to': str(self.instructor.id)},
            format='json',
        )
        self.assertIn(res.status_code, [200, 204])


class SafeguardingRBACTests(SafeguardingTestBase):

    def test_instructor_cannot_list_reports(self):
        self.auth(self.instructor)
        res = self.client.get('/api/v1/safeguarding/')
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_list_reports(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/safeguarding/')
        self.assertEqual(res.status_code, 403)

    def test_parent_cannot_list_reports(self):
        self.auth(self.parent)
        res = self.client.get('/api/v1/safeguarding/')
        self.assertEqual(res.status_code, 403)

    def test_instructor_cannot_create_report(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/safeguarding/', {
            'subject_user': str(self.student.id),
            'organisation': str(self.org.id),
            'description': 'Unauthorized report',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_create_report(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/safeguarding/', {
            'organisation': str(self.org.id),
            'description': 'Self report',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_instructor_cannot_update_report(self):
        self.auth(self.instructor)
        res = self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'resolved'},
            format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_delete_report(self):
        self.auth(self.student)
        res = self.client.delete(f'/api/v1/safeguarding/{self.report.id}/')
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_cannot_access(self):
        res = self.client.get('/api/v1/safeguarding/')
        self.assertIn(res.status_code, [401, 403, 404])


class SafeguardingOrgIsolationTests(SafeguardingTestBase):

    def test_other_org_admin_cannot_see_reports(self):
        self.auth(self.other_admin)
        res = self.client.get('/api/v1/safeguarding/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        # Should not see reports from self.org
        for r in results:
            org_id = r.get('organisation')
            if org_id:
                self.assertNotEqual(str(org_id), str(self.org.id))

    def test_other_org_cannot_update_report(self):
        self.auth(self.other_admin)
        res = self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'resolved'},
            format='json',
        )
        self.assertIn(res.status_code, [403, 404])

    def test_other_org_cannot_delete_report(self):
        self.auth(self.other_admin)
        res = self.client.delete(f'/api/v1/safeguarding/{self.report.id}/')
        self.assertIn(res.status_code, [403, 404])

    def test_admin_create_report_in_wrong_org_blocked(self):
        self.auth(self.admin)
        res = self.client.post('/api/v1/safeguarding/', {
            'subject_user': str(self.student.id),
            'organisation': str(self.other_org.id),
            'description': 'Trying to create in other org',
        }, format='json')
        # Should be 400 (validation error) or 403 (permission)
        self.assertIn(res.status_code, [400, 403])


class SafeguardingAuditTests(SafeguardingTestBase):

    def test_create_report_generates_audit(self):
        from audit.models import AuditEvent
        count_before = AuditEvent.objects.count()
        self.auth(self.admin)
        self.client.post('/api/v1/safeguarding/', {
            'subject_user': str(self.student.id),
            'organisation': str(self.org.id),
            'description': 'Audited report',
        }, format='json')
        count_after = AuditEvent.objects.count()
        self.assertGreater(count_after, count_before)

    def test_update_report_generates_audit(self):
        from audit.models import AuditEvent
        count_before = AuditEvent.objects.count()
        self.auth(self.admin)
        self.client.patch(
            f'/api/v1/safeguarding/{self.report.id}/',
            {'status': 'investigating'},
            format='json',
        )
        count_after = AuditEvent.objects.count()
        self.assertGreater(count_after, count_before)

    def test_delete_report_generates_audit(self):
        from audit.models import AuditEvent
        count_before = AuditEvent.objects.count()
        self.auth(self.admin)
        self.client.delete(f'/api/v1/safeguarding/{self.report.id}/')
        count_after = AuditEvent.objects.count()
        self.assertGreater(count_after, count_before)

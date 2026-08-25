"""
Tests for certificate RBAC, issuance, revocation, and public verification.
"""
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Enrolment
from certificates.models import Certificate


class CertificateTestBase(TestCase):
    """Shared setup for certificate tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Cert Org', slug='cert-org')

        self.owner_role, _ = Role.objects.get_or_create(name='owner')
        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')
        self.parent_role, _ = Role.objects.get_or_create(name='parent')

        self.owner = User.objects.create_user(
            email='owner@cert.test', password='pass123',
            supabase_uid='owner-cert-uid', full_name='Owner',
        )
        self.admin = User.objects.create_user(
            email='admin@cert.test', password='pass123',
            supabase_uid='admin-cert-uid', full_name='Admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@cert.test', password='pass123',
            supabase_uid='instructor-cert-uid', full_name='Instructor',
        )
        self.student = User.objects.create_user(
            email='student@cert.test', password='pass123',
            supabase_uid='student-cert-uid', full_name='Student',
        )
        self.parent = User.objects.create_user(
            email='parent@cert.test', password='pass123',
            supabase_uid='parent-cert-uid', full_name='Parent',
        )

        for user, role in [
            (self.owner, self.owner_role),
            (self.admin, self.admin_role),
            (self.instructor, self.instructor_role),
            (self.student, self.student_role),
            (self.parent, self.parent_role),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

        self.programme = Programme.objects.create(
            organisation=self.org, name='Test Programme', slug='test-prog', level='shs',
        )
        self.course = Course.objects.create(
            programme=self.programme, organisation=self.org,
            title='Test Course', slug='test-course',
            instructor=self.instructor, is_published=True,
        )

        self.cert = Certificate.objects.create(
            recipient=self.student, organisation=self.org,
            course=self.course, programme=self.programme,
            title='Course Completion',
            recipient_name='Student', recipient_email='student@cert.test',
            issued_date=date.today(), issued_by=self.instructor,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class CertificateRBACTests(CertificateTestBase):
    """Test certificate RBAC enforcement."""

    def test_student_sees_own_certificates(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/certificates/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertGreaterEqual(len(results), 1)

    def test_student_does_not_see_others(self):
        other = User.objects.create_user(
            email='other@cert.test', password='pass123',
            supabase_uid='other-cert-uid', full_name='Other',
        )
        Certificate.objects.create(
            recipient=other, organisation=self.org,
            title='Other Cert', recipient_name='Other',
            recipient_email='other@cert.test', issued_date=date.today(),
        )
        self.auth(self.student)
        res = self.client.get('/api/v1/certificates/')
        results = res.data.get('results', res.data)
        for cert in results:
            self.assertNotEqual(cert['recipient'], str(other.id))

    def test_instructor_can_issue(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/certificates/', {
            'recipient': str(self.student.id),
            'course': str(self.course.id),
            'title': 'New Certificate',
            'recipient_name': 'Student',
            'recipient_email': 'student@cert.test',
            'issued_date': date.today().isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_student_cannot_issue(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/certificates/', {
            'recipient': str(self.student.id),
            'title': 'Self Cert',
            'recipient_name': 'Student',
            'recipient_email': 'student@cert.test',
            'issued_date': date.today().isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_owner_can_revoke(self):
        self.auth(self.owner)
        res = self.client.post(f'/api/v1/certificates/{self.cert.id}/revoke/', {
            'reason': 'Academic misconduct',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.cert.refresh_from_db()
        self.assertEqual(self.cert.status, 'revoked')

    def test_student_cannot_revoke(self):
        self.auth(self.student)
        res = self.client.post(f'/api/v1/certificates/{self.cert.id}/revoke/', {
            'reason': 'test',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_parent_sees_child_certificates(self):
        from identity.models import ParentChildLink
        ParentChildLink.objects.create(
            parent_user=self.parent,
            student_user=self.student,
            is_verified=True, is_active=True, consent_given=True,
        )
        self.auth(self.parent)
        res = self.client.get('/api/v1/certificates/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertGreaterEqual(len(results), 1)


class PublicVerifyTests(CertificateTestBase):
    """Test public certificate verification."""

    def test_verify_valid(self):
        res = self.client.get(
            f'/api/v1/certificates/verify/{self.cert.verification_code}/'
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['valid'])
        self.assertEqual(res.data['certificate_number'], self.cert.certificate_number)

    def test_verify_revoked(self):
        self.cert.status = 'revoked'
        self.cert.save()
        res = self.client.get(
            f'/api/v1/certificates/verify/{self.cert.verification_code}/'
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['valid'])

    def test_verify_not_found(self):
        res = self.client.get('/api/v1/certificates/verify/invalid-code/')
        self.assertEqual(res.status_code, 404)

"""
Tests for content library file upload endpoints and RBAC.
"""
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course
from content.models import ContentItem, ContentStatusLog


class ContentUploadTestBase(TestCase):
    """Shared setup for content upload tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Upload Org', slug='upload-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.admin = User.objects.create_user(
            email='admin@upload.test', password='pass',
            supabase_uid='uid-up-admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@upload.test', password='pass',
            supabase_uid='uid-up-instructor',
        )
        self.student = User.objects.create_user(
            email='student@upload.test', password='pass',
            supabase_uid='uid-up-student',
        )

        for user, role in [
            (self.admin, self.admin_role),
            (self.instructor, self.instructor_role),
            (self.student, self.student_role),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

        self.programme = Programme.objects.create(
            organisation=self.org, name='Science', slug='science', level='shs',
        )
        self.course = Course.objects.create(
            title='Physics 10', programme=self.programme,
            organisation=self.org, instructor=self.instructor, slug='physics-10',
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)


class RequestContentUploadTest(ContentUploadTestBase):
    """Test the content upload URL request endpoint."""

    def test_instructor_can_request_upload_url(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/request/', {
            'filename': 'report.pdf',
            'file_size': 1024,
            'content_type': 'application/pdf',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('upload_url', res.data)
        self.assertIn('file_path', res.data)
        self.assertTrue(res.data['file_path'].startswith(f'{self.org.id}/'))

    def test_admin_can_request_upload_url(self):
        self._auth(self.admin)
        res = self.client.post('/api/v1/content/upload/request/', {
            'filename': 'slides.pdf',
            'file_size': 2048,
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('upload_url', res.data)

    def test_student_cannot_request_upload_url(self):
        self._auth(self.student)
        res = self.client.post('/api/v1/content/upload/request/', {
            'filename': 'report.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_denied(self):
        res = self.client.post('/api/v1/content/upload/request/', {
            'filename': 'report.pdf',
            'file_size': 1024,
        })
        # DRF returns 403 for unauthenticated requests with session auth (project convention)
        self.assertEqual(res.status_code, 403)

    def test_invalid_file_type_rejected(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/request/', {
            'filename': 'virus.exe',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('not allowed', res.data['detail'])

    def test_oversized_file_rejected(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/request/', {
            'filename': 'huge.pdf',
            'file_size': 60 * 1024 * 1024,  # 60 MB > 25 MB document cap
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('too large', res.data['detail'])


class ConfirmContentUploadTest(ContentUploadTestBase):
    """Test the content upload confirmation endpoint."""

    def test_instructor_can_confirm_upload_creates_draft(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/confirm/', {
            'file_path': f'{self.org.id}/{self.instructor.id}/abc123.pdf',
            'original_filename': 'report.pdf',
            'file_size': 1024,
            'content_type': 'application/pdf',
            'title': 'Physics Report',
            'tags': ['physics', 'report'],
        })
        self.assertEqual(res.status_code, 201)
        item = ContentItem.objects.get(id=res.data['id'])
        self.assertEqual(item.status, 'draft')
        self.assertEqual(item.uploaded_by, self.instructor)
        self.assertEqual(item.organisation, self.org)
        self.assertEqual(item.content_type, 'document')
        self.assertEqual(item.file_url, f'{self.org.id}/{self.instructor.id}/abc123.pdf')
        self.assertTrue(ContentStatusLog.objects.filter(content_item=item, action='created').exists())

    def test_confirm_with_course_attaches_course(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/confirm/', {
            'file_path': f'{self.org.id}/{self.instructor.id}/abc456.png',
            'original_filename': 'diagram.png',
            'file_size': 2048,
            'content_type': 'image/png',
            'course_id': str(self.course.id),
        })
        self.assertEqual(res.status_code, 201)
        item = ContentItem.objects.get(id=res.data['id'])
        self.assertEqual(item.course, self.course)
        self.assertEqual(item.content_type, 'image')

    def test_confirm_with_foreign_course_rejected(self):
        other_org = Organisation.objects.create(name='Other Org', slug='other-org')
        other_prog = Programme.objects.create(
            organisation=other_org, name='Other', slug='other', level='shs',
        )
        other_course = Course.objects.create(
            title='Other Course', programme=other_prog,
            organisation=other_org, instructor=self.instructor, slug='other-course',
        )
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/confirm/', {
            'file_path': f'{self.org.id}/{self.instructor.id}/abc789.pdf',
            'original_filename': 'report.pdf',
            'file_size': 1024,
            'course_id': str(other_course.id),
        })
        self.assertEqual(res.status_code, 400)

    def test_confirm_path_outside_org_rejected(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/content/upload/confirm/', {
            'file_path': f'other-org-id/{self.instructor.id}/evil.pdf',
            'original_filename': 'evil.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_confirm_upload(self):
        self._auth(self.student)
        res = self.client.post('/api/v1/content/upload/confirm/', {
            'file_path': f'{self.org.id}/{self.student.id}/x.pdf',
            'original_filename': 'x.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)


class ContentDownloadTest(ContentUploadTestBase):
    """Test the content download (signed URL) action."""

    def setUp(self):
        super().setUp()
        self.item = ContentItem.objects.create(
            organisation=self.org, course=self.course, title='Report',
            content_type='document', file_url=f'{self.org.id}/{self.instructor.id}/abc.pdf',
            mime_type='application/pdf', file_size=1024,
            uploaded_by=self.instructor, status='published',
        )

    @patch('core.storage.get_supabase_signed_url', return_value=('https://signed.example/file', ''))
    def test_owner_can_download(self, mock_signed):
        self._auth(self.instructor)
        res = self.client.get(f'/api/v1/content/{self.item.id}/download/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['url'], 'https://signed.example/file')
        mock_signed.assert_called_once()

    def test_item_without_file_returns_404(self):
        item = ContentItem.objects.create(
            organisation=self.org, course=self.course, title='Empty',
            content_type='document', file_url='',
            uploaded_by=self.instructor, status='published',
        )
        self._auth(self.instructor)
        res = self.client.get(f'/api/v1/content/{item.id}/download/')
        self.assertEqual(res.status_code, 404)
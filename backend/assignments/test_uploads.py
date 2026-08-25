"""
Tests for assignment file upload endpoints.
"""
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Enrolment
from assignments.models import Assignment, AssignmentSubmission
from core.storage import validate_file, generate_upload_path, get_file_category


class UploadTestBase(TestCase):
    """Shared setup for upload tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Upload Org', slug='upload-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.admin = User.objects.create_user(
            email='admin@upload.test', password='pass',
            supabase_uid='uid-upload-admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@upload.test', password='pass',
            supabase_uid='uid-upload-instructor',
        )
        self.student = User.objects.create_user(
            email='student@upload.test', password='pass',
            supabase_uid='uid-upload-student',
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
        Enrolment.objects.create(
            student=self.student, course=self.course, status='active',
        )
        self.assignment = Assignment.objects.create(
            title='Lab Report', course=self.course, organisation=self.org,
            created_by=self.instructor, max_score=100, max_attempts=3,
            allowed_file_types=['.pdf', '.docx', '.png', '.jpg'],
            max_file_size_mb=10, status='published',
        )
        self.submission = AssignmentSubmission.objects.create(
            assignment=self.assignment, student=self.student,
            attempt_number=1, status='draft',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class FileValidationTest(TestCase):
    """Test file validation utility."""

    def test_valid_pdf(self):
        is_valid, error = validate_file('report.pdf', 1024 * 1024)
        self.assertTrue(is_valid)
        self.assertEqual(error, '')

    def test_valid_docx(self):
        is_valid, error = validate_file('report.docx', 2 * 1024 * 1024)
        self.assertTrue(is_valid)

    def test_valid_png(self):
        is_valid, error = validate_file('screenshot.png', 5 * 1024 * 1024)
        self.assertTrue(is_valid)

    def test_invalid_exe(self):
        is_valid, error = validate_file('malware.exe', 1024)
        self.assertFalse(is_valid)
        self.assertIn('.exe', error)

    def test_invalid_php(self):
        is_valid, error = validate_file('shell.php', 1024)
        self.assertFalse(is_valid)

    def test_too_large_image(self):
        is_valid, error = validate_file('huge.png', 15 * 1024 * 1024)
        self.assertFalse(is_valid)
        self.assertIn('too large', error.lower())

    def test_too_large_document(self):
        is_valid, error = validate_file('huge.pdf', 30 * 1024 * 1024)
        self.assertFalse(is_valid)

    def test_allowed_types_restriction(self):
        is_valid, error = validate_file('report.pdf', 1024, allowed_types=['.pdf', '.docx'])
        self.assertTrue(is_valid)

        is_valid, error = validate_file('image.png', 1024, allowed_types=['.pdf', '.docx'])
        self.assertFalse(is_valid)
        self.assertIn('.png', error)

    def test_file_category(self):
        self.assertEqual(get_file_category('.pdf'), 'document')
        self.assertEqual(get_file_category('.png'), 'image')
        self.assertEqual(get_file_category('.xlsx'), 'spreadsheet')
        self.assertEqual(get_file_category('.py'), 'code')
        self.assertEqual(get_file_category('.xyz'), 'default')


class GenerateUploadPathTest(TestCase):
    """Test upload path generation."""

    def test_path_structure(self):
        path = generate_upload_path('org-1', 'user-1', 'assign-1', 'report.pdf')
        parts = path.split('/')
        self.assertEqual(len(parts), 4)
        self.assertEqual(parts[0], 'org-1')
        self.assertEqual(parts[1], 'assign-1')
        self.assertEqual(parts[2], 'user-1')
        self.assertTrue(parts[3].endswith('.pdf'))

    def test_no_original_filename_in_path(self):
        path = generate_upload_path('org-1', 'user-1', 'assign-1', '../../../etc/passwd.pdf')
        self.assertNotIn('..', path)
        self.assertNotIn('etc', path)

    def test_unique_paths(self):
        path1 = generate_upload_path('org-1', 'user-1', 'assign-1', 'report.pdf')
        path2 = generate_upload_path('org-1', 'user-1', 'assign-1', 'report.pdf')
        self.assertNotEqual(path1, path2)


class RequestUploadURLTest(UploadTestBase):
    """Test the upload URL request endpoint."""

    def test_student_can_request_url(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/submissions/upload/request/', {
            'assignment_id': str(self.assignment.id),
            'filename': 'report.pdf',
            'file_size': 1024 * 1024,
            'content_type': 'application/pdf',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('upload_url', res.data)
        self.assertIn('file_path', res.data)
        self.assertIn('file_id', res.data)

    def test_instructor_cannot_request_url(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/assignments/submissions/upload/request/', {
            'assignment_id': str(self.assignment.id),
            'filename': 'report.pdf',
            'file_size': 1024 * 1024,
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_invalid_file_type_rejected(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/submissions/upload/request/', {
            'assignment_id': str(self.assignment.id),
            'filename': 'malware.exe',
            'file_size': 1024,
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('not allowed', res.data['detail'].lower())

    def test_file_too_large_rejected(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/submissions/upload/request/', {
            'assignment_id': str(self.assignment.id),
            'filename': 'huge.pdf',
            'file_size': 15 * 1024 * 1024,  # 15 MB > 10 MB limit
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('size', res.data['detail'].lower())

    def test_missing_assignment_rejected(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/submissions/upload/request/', {
            'assignment_id': '00000000-0000-0000-0000-000000000000',
            'filename': 'report.pdf',
            'file_size': 1024,
        }, format='json')
        self.assertEqual(res.status_code, 404)


class ConfirmUploadTest(UploadTestBase):
    """Test the upload confirmation endpoint."""

    def test_student_can_confirm_upload(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/submissions/upload/confirm/', {
            'submission_id': str(self.submission.id),
            'file_path': f'{self.org.id}/{self.assignment.id}/{self.student.id}/abc123.pdf',
            'original_filename': 'report.pdf',
            'file_size': 1024 * 1024,
            'content_type': 'application/pdf',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total_files'], 1)

        self.submission.refresh_from_db()
        self.assertEqual(len(self.submission.file_urls), 1)
        self.assertEqual(self.submission.file_urls[0]['original_filename'], 'report.pdf')

    def test_cannot_add_files_to_submitted(self):
        self.submission.status = 'submitted'
        self.submission.save()
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/submissions/upload/confirm/', {
            'submission_id': str(self.submission.id),
            'file_path': 'test/file.pdf',
            'original_filename': 'report.pdf',
            'file_size': 1024,
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_multiple_files_allowed(self):
        self.auth(self.student)
        for i in range(3):
            self.client.post('/api/v1/assignments/submissions/upload/confirm/', {
                'submission_id': str(self.submission.id),
                'file_path': f'path/to/file{i}.pdf',
                'original_filename': f'report{i}.pdf',
                'file_size': 1024,
            }, format='json')
        self.submission.refresh_from_db()
        self.assertEqual(len(self.submission.file_urls), 3)


class RemoveUploadTest(UploadTestBase):
    """Test the file removal endpoint."""

    def setUp(self):
        super().setUp()
        # Pre-add a file
        self.submission.file_urls = [{
            'file_path': f'{self.org.id}/{self.assignment.id}/{self.student.id}/abc123.pdf',
            'original_filename': 'report.pdf',
            'file_size': 1024,
        }]
        self.submission.save()

    def test_student_can_remove_file(self):
        self.auth(self.student)
        file_path = self.submission.file_urls[0]['file_path']
        res = self.client.post('/api/v1/assignments/submissions/upload/remove/', {
            'submission_id': str(self.submission.id),
            'file_path': file_path,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total_files'], 0)

    def test_cannot_remove_from_submitted(self):
        self.submission.status = 'submitted'
        self.submission.save()
        self.auth(self.student)
        file_path = self.submission.file_urls[0]['file_path']
        res = self.client.post('/api/v1/assignments/submissions/upload/remove/', {
            'submission_id': str(self.submission.id),
            'file_path': file_path,
        }, format='json')
        self.assertEqual(res.status_code, 400)


class DownloadURLTest(UploadTestBase):
    """Test the signed download URL endpoint."""

    def setUp(self):
        super().setUp()
        self.file_path = f'{self.org.id}/{self.assignment.id}/{self.student.id}/abc123.pdf'
        self.submission.file_urls = [{
            'file_path': self.file_path,
            'original_filename': 'report.pdf',
            'file_size': 1024,
        }]
        self.submission.save()

    @patch('assignments.views_uploads.get_supabase_signed_url')
    def test_student_can_download_own_file(self, mock_signed):
        mock_signed.return_value = ('https://mock.supabase.co/signed-url', '')
        self.auth(self.student)
        res = self.client.get(
            f'/api/v1/assignments/submissions/{self.submission.id}/download/{self.file_path}/'
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('signed_url', res.data)
        self.assertEqual(res.data['file_path'], self.file_path)

    @patch('assignments.views_uploads.get_supabase_signed_url')
    def test_instructor_can_download_student_file(self, mock_signed):
        mock_signed.return_value = ('https://mock.supabase.co/signed-url', '')
        self.auth(self.instructor)
        res = self.client.get(
            f'/api/v1/assignments/submissions/{self.submission.id}/download/{self.file_path}/'
        )
        self.assertEqual(res.status_code, 200)

    def test_other_student_cannot_download(self):
        other = User.objects.create_user(
            email='other@upload.test', password='pass', supabase_uid='uid-upload-other',
        )
        RoleAssignment.objects.create(
            user=other, role=self.student_role, organisation=self.org,
            status='active', valid_from=timezone.now(),
        )
        self.auth(other)
        res = self.client.get(
            f'/api/v1/assignments/submissions/{self.submission.id}/download/{self.file_path}/'
        )
        self.assertEqual(res.status_code, 403)

    def test_invalid_file_path_rejected(self):
        self.auth(self.student)
        res = self.client.get(
            f'/api/v1/assignments/submissions/{self.submission.id}/download/fake/path.pdf/'
        )
        self.assertEqual(res.status_code, 404)

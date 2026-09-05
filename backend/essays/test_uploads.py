"""
Tests for essay response file upload endpoints and RBAC.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Enrolment
from essays.models import EssayQuestion, EssayResponse


class EssayUploadTestBase(TestCase):
    """Shared setup for essay upload tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Essay Org', slug='essay-org')

        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.instructor = User.objects.create_user(
            email='instructor@essay.test', password='pass',
            supabase_uid='uid-essay-instructor',
        )
        self.student = User.objects.create_user(
            email='student@essay.test', password='pass',
            supabase_uid='uid-essay-student',
        )

        for user, role in [
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
        self.question = EssayQuestion.objects.create(
            title='Describe Newton\'s laws', course=self.course,
            marks=100, status='published', allow_file_upload=True,
            created_by=self.instructor,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)


class RequestEssayUploadTest(EssayUploadTestBase):
    """Test the essay upload URL request endpoint."""

    def test_student_can_request_upload_url(self):
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/request/', {
            'question_id': str(self.question.id),
            'filename': 'essay.pdf',
            'file_size': 1024,
            'content_type': 'application/pdf',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('upload_url', res.data)
        self.assertTrue(res.data['file_path'].startswith(f'{self.org.id}/{self.question.id}/'))

    def test_instructor_cannot_request_upload(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/essays/upload/request/', {
            'question_id': str(self.question.id),
            'filename': 'essay.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)

    def test_question_without_file_upload_rejected(self):
        self.question.allow_file_upload = False
        self.question.save()
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/request/', {
            'question_id': str(self.question.id),
            'filename': 'essay.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('does not allow', res.data['detail'])

    def test_draft_question_rejected(self):
        self.question.status = 'draft'
        self.question.save()
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/request/', {
            'question_id': str(self.question.id),
            'filename': 'essay.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 400)

    def test_invalid_file_type_rejected(self):
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/request/', {
            'question_id': str(self.question.id),
            'filename': 'virus.exe',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('not allowed', res.data['detail'])

    def test_unenrolled_student_rejected(self):
        other_student = User.objects.create_user(
            email='other@essay.test', password='pass', supabase_uid='uid-essay-other',
        )
        RoleAssignment.objects.create(
            user=other_student, role=self.student_role, organisation=self.org,
            status='active', valid_from=timezone.now(),
        )
        self._auth(other_student)
        res = self.client.post('/api/v1/essays/upload/request/', {
            'question_id': str(self.question.id),
            'filename': 'essay.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)


class ConfirmEssayUploadTest(EssayUploadTestBase):
    """Test the essay upload confirmation endpoint."""

    def setUp(self):
        super().setUp()
        self.response = EssayResponse.objects.create(
            question=self.question, student=self.student,
            typed_answer='My essay', status='draft', version=1,
        )

    def test_student_can_confirm_upload_attaches_file(self):
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/confirm/', {
            'response_id': str(self.response.id),
            'file_path': f'{self.org.id}/{self.question.id}/{self.student.id}/abc.pdf',
            'original_filename': 'essay.pdf',
            'file_size': 1024,
            'content_type': 'application/pdf',
        })
        self.assertEqual(res.status_code, 200)
        self.response.refresh_from_db()
        self.assertEqual(len(self.response.attachments), 1)
        self.assertEqual(self.response.attachments[0]['original_filename'], 'essay.pdf')

    def test_confirm_on_submitted_response_rejected(self):
        self.response.status = 'submitted'
        self.response.save()
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/confirm/', {
            'response_id': str(self.response.id),
            'file_path': f'{self.org.id}/{self.question.id}/{self.student.id}/abc.pdf',
            'original_filename': 'essay.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 400)

    def test_confirm_path_outside_own_folder_rejected(self):
        self._auth(self.student)
        res = self.client.post('/api/v1/essays/upload/confirm/', {
            'response_id': str(self.response.id),
            'file_path': f'{self.org.id}/{self.question.id}/other-user/evil.pdf',
            'original_filename': 'evil.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)

    def test_instructor_cannot_confirm(self):
        self._auth(self.instructor)
        res = self.client.post('/api/v1/essays/upload/confirm/', {
            'response_id': str(self.response.id),
            'file_path': f'{self.org.id}/{self.question.id}/{self.student.id}/abc.pdf',
            'original_filename': 'essay.pdf',
            'file_size': 1024,
        })
        self.assertEqual(res.status_code, 403)
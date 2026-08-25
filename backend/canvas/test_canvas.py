"""
Tests for Canvas 4-layer CRUD, RBAC, autosave, version history, submission.
"""
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Course
from essays.models import EssayQuestion, EssayResponse
from canvas.models import CanvasDocument, CanvasVersion


class CanvasBaseTest(TestCase):
    """Shared fixtures for canvas tests."""

    def setUp(self):
        self.client = APIClient()

        # Users (each needs a unique supabase_uid)
        self.owner = User.objects.create_user(email='owner@test.com', password='pass', supabase_uid='uid-owner-001')
        self.admin = User.objects.create_user(email='admin@test.com', password='pass', supabase_uid='uid-admin-001')
        self.instructor = User.objects.create_user(email='instructor@test.com', password='pass', supabase_uid='uid-instructor-001')
        self.student = User.objects.create_user(email='student@test.com', password='pass', supabase_uid='uid-student-001')
        self.other_student = User.objects.create_user(email='other@test.com', password='pass', supabase_uid='uid-other-001')
        self.parent = User.objects.create_user(email='parent@test.com', password='pass', supabase_uid='uid-parent-001')

        # Org
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')

        # Programme
        from courses.models import Programme
        self.programme = Programme.objects.create(
            organisation=self.org,
            name='Science Programme',
            slug='science',
            level='shs',
        )

        # Roles
        self.role_owner = Role.objects.create(name='owner', display_name='Owner')
        self.role_admin = Role.objects.create(name='admin', display_name='Admin')
        self.role_instructor = Role.objects.create(name='instructor', display_name='Instructor')
        self.role_student = Role.objects.create(name='student', display_name='Student')
        self.role_parent = Role.objects.create(name='parent', display_name='Parent')

        # Role assignments
        RoleAssignment.objects.create(user=self.owner, role=self.role_owner, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.admin, role=self.role_admin, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.instructor, role=self.role_instructor, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.student, role=self.role_student, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.other_student, role=self.role_student, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.parent, role=self.role_parent, organisation=self.org, status='active')

        # Course
        self.course = Course.objects.create(
            title='Physics 10',
            programme=self.programme,
            organisation=self.org,
            instructor=self.instructor,
            slug='physics-10',
        )

        # Essay question
        self.question = EssayQuestion.objects.create(
            title='Newton\'s Second Law',
            description='Calculate acceleration',
            marks=100,
            course=self.course,
            created_by=self.instructor,
        )

        # Essay response
        self.response = EssayResponse.objects.create(
            question=self.question,
            student=self.student,
        )

        # Canvas document
        self.canvas = CanvasDocument.objects.create(
            student=self.student,
            course=self.course,
            essay_response=self.response,
            question_data={
                'strokes': [
                    {'id': 'q1', 'tool': 'text', 'text': 'Q1: Calculate acceleration', 'layer': 'question'}
                ]
            },
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class CanvasDocumentCRUDTest(CanvasBaseTest):
    """Test basic CRUD operations."""

    def test_list_canvas_as_student(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/canvas-documents/')
        self.assertEqual(res.status_code, 200)

    def test_retrieve_canvas_as_student_own(self):
        self.auth(self.student)
        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('question_data', res.data)
        self.assertIn('student_answer_data', res.data)

    def test_student_cannot_see_other_student_canvas(self):
        self.auth(self.other_student)
        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/')
        self.assertIn(res.status_code, [403, 404])

    def test_instructor_can_see_course_canvas(self):
        self.auth(self.instructor)
        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/')
        self.assertEqual(res.status_code, 200)

    def test_owner_can_see_all_canvas(self):
        self.auth(self.owner)
        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/')
        self.assertEqual(res.status_code, 200)


class CanvasFourLayerTest(CanvasBaseTest):
    """Test 4-layer data separation."""

    def test_create_canvas_with_layers(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/canvas-documents/', {
            'course': str(self.course.id),
            'essay_response': str(self.response.id),
            'question_data': {'strokes': [{'id': 'q1', 'text': 'Question'}]},
            'student_answer_data': {'strokes': [{'id': 's1', 'text': 'Answer'}]},
        }, format='json')
        self.assertEqual(res.status_code, 201)
        doc = CanvasDocument.objects.get(id=res.data['id'])
        self.assertEqual(doc.student, self.student)
        self.assertIn('Question', str(doc.question_data))

    def test_student_can_update_answer_layer(self):
        self.auth(self.student)
        res = self.client.patch(f'/api/v1/canvas-documents/{self.canvas.id}/', {
            'student_answer_data': {'strokes': [{'id': 's1', 'text': 'My answer'}]},
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.canvas.refresh_from_db()
        self.assertIn('My answer', str(self.canvas.student_answer_data))

    def test_student_cannot_update_question_layer(self):
        self.auth(self.student)
        res = self.client.patch(f'/api/v1/canvas-documents/{self.canvas.id}/', {
            'question_data': {'strokes': [{'id': 'hacked', 'text': 'Hacked'}]},
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_instructor_can_update_feedback_layer(self):
        self.auth(self.instructor)
        res = self.client.patch(f'/api/v1/canvas-documents/{self.canvas.id}/', {
            'teacher_feedback_data': {'strokes': [{'id': 't1', 'text': 'Good work!'}]},
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.canvas.refresh_from_db()
        self.assertIn('Good work', str(self.canvas.teacher_feedback_data))

    def test_instructor_cannot_update_student_layer(self):
        self.auth(self.instructor)
        res = self.client.patch(f'/api/v1/canvas-documents/{self.canvas.id}/', {
            'student_answer_data': {'strokes': [{'id': 'hacked', 'text': 'Changed'}]},
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_student_can_update_revision_layer(self):
        self.auth(self.student)
        res = self.client.patch(f'/api/v1/canvas-documents/{self.canvas.id}/', {
            'student_revision_data': {'strokes': [{'id': 'r1', 'text': 'Revised'}]},
        }, format='json')
        self.assertEqual(res.status_code, 200)


class CanvasAutosaveTest(CanvasBaseTest):
    """Test autosave with version tracking."""

    def test_autosave_creates_version(self):
        self.auth(self.student)
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
            'layer': 'student',
            'data': {'strokes': [{'id': 's1', 'text': 'Autosaved work'}]},
            'expected_version': self.canvas.document_version,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('version', res.data)
        self.canvas.refresh_from_db()
        self.assertEqual(self.canvas.document_version, 2)
        self.assertTrue(CanvasVersion.objects.filter(document=self.canvas).exists())

    def test_autosave_rejects_stale_version(self):
        self.auth(self.student)
        # First save
        self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
            'layer': 'student',
            'data': {'strokes': [{'id': 's1'}]},
            'expected_version': 1,
        }, format='json')
        # Second save with wrong version
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
            'layer': 'student',
            'data': {'strokes': [{'id': 's2'}]},
            'expected_version': 1,  # should be 2 now
        }, format='json')
        self.assertEqual(res.status_code, 409)  # Conflict

    def test_autosave_teacher_layer(self):
        self.auth(self.instructor)
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
            'layer': 'teacher',
            'data': {'strokes': [{'id': 't1', 'text': 'Feedback'}]},
            'expected_version': self.canvas.document_version,
        }, format='json')
        self.assertEqual(res.status_code, 200)

    def test_autosave_student_cannot_update_teacher_layer(self):
        self.auth(self.student)
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
            'layer': 'teacher',
            'data': {'strokes': [{'id': 't1', 'text': 'Fake feedback'}]},
            'expected_version': self.canvas.document_version,
        }, format='json')
        self.assertEqual(res.status_code, 403)


class CanvasSubmissionTest(CanvasBaseTest):
    """Test submission workflow."""

    def test_student_can_submit(self):
        self.auth(self.student)
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/submit/')
        self.assertEqual(res.status_code, 200)
        self.canvas.refresh_from_db()
        self.assertEqual(self.canvas.status, 'submitted')
        self.assertTrue(self.canvas.is_locked)

    def test_submitted_canvas_is_locked(self):
        self.auth(self.student)
        self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/submit/')
        # Try to edit after submission
        self.auth(self.student)
        res = self.client.patch(f'/api/v1/canvas-documents/{self.canvas.id}/', {
            'student_answer_data': {'strokes': [{'id': 's1', 'text': 'Should fail'}]},
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_other_student_cannot_submit(self):
        self.auth(self.other_student)
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/submit/')
        self.assertIn(res.status_code, [403, 404])

    def test_instructor_can_return_for_revision(self):
        # Submit first
        self.auth(self.student)
        self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/submit/')

        # Return
        self.auth(self.instructor)
        res = self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/return-for-revision/', {
            'reason': 'Please add units to your answer.',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.canvas.refresh_from_db()
        self.assertEqual(self.canvas.status, 'returned')
        self.assertFalse(self.canvas.is_locked)


class CanvasVersionHistoryTest(CanvasBaseTest):
    """Test version history endpoint."""

    def test_version_history_empty(self):
        self.auth(self.student)
        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/versions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_version_history_after_autosave(self):
        self.auth(self.student)
        # Create 3 autosaves
        for i in range(3):
            self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
                'layer': 'student',
                'data': {'strokes': [{'id': f's{i}'}]},
                'expected_version': self.canvas.document_version + i,
            }, format='json')

        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/versions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 3)
        # Most recent first (v4 is the latest after 3 autosaves from v1)
        self.assertGreaterEqual(res.data[0]['version_number'], 3)

    def test_get_specific_version(self):
        self.auth(self.student)
        self.client.post(f'/api/v1/canvas-documents/{self.canvas.id}/autosave/', {
            'layer': 'student',
            'data': {'strokes': [{'id': 's0'}]},
            'expected_version': 1,
        }, format='json')

        # Get the latest version from the list
        res = self.client.get(f'/api/v1/canvas-documents/{self.canvas.id}/versions/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 1)
        self.assertIn('version_number', res.data[0])

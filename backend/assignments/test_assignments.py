"""
Tests for Assignment and AssignmentSubmission RBAC and workflows.
"""
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment
from assignments.models import Assignment, AssignmentSubmission


class AssignmentAPITestBase(TestCase):
    """Shared setup for assignment API tests."""

    def setUp(self):
        self.client = APIClient()

        self.org = Organisation.objects.create(name='Test Org', slug='test-org')

        # Create roles
        self.owner_role, _ = Role.objects.get_or_create(name='owner')
        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')
        self.parent_role, _ = Role.objects.get_or_create(name='parent')

        # Create users
        self.owner = User.objects.create_user(
            email='owner@test.com', password='pass123',
            supabase_uid='owner-test-uid', full_name='Owner',
        )
        self.admin = User.objects.create_user(
            email='admin@test.com', password='pass123',
            supabase_uid='admin-test-uid', full_name='Admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@test.com', password='pass123',
            supabase_uid='instructor-test-uid', full_name='Instructor',
        )
        self.student = User.objects.create_user(
            email='student@test.com', password='pass123',
            supabase_uid='student-test-uid', full_name='Student',
        )
        self.other_student = User.objects.create_user(
            email='other@test.com', password='pass123',
            supabase_uid='other-test-uid', full_name='Other',
        )
        self.parent = User.objects.create_user(
            email='parent@test.com', password='pass123',
            supabase_uid='parent-test-uid', full_name='Parent',
        )

        # Assign roles
        for user, role in [
            (self.owner, self.owner_role),
            (self.admin, self.admin_role),
            (self.instructor, self.instructor_role),
            (self.student, self.student_role),
            (self.other_student, self.student_role),
            (self.parent, self.parent_role),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

        # Programme, course, lessons
        self.programme = Programme.objects.create(
            organisation=self.org, name='Test Programme', slug='test-prog',
            level='shs',
        )
        self.course = Course.objects.create(
            programme=self.programme, organisation=self.org,
            title='Test Course', slug='test-course',
            instructor=self.instructor, is_published=True,
        )
        self.lesson = Lesson.objects.create(
            course=self.course, title='Test Lesson', order=1,
            content_type='text', is_published=True,
        )

        # Enrolments
        Enrolment.objects.create(student=self.student, course=self.course, status='active')
        Enrolment.objects.create(student=self.other_student, course=self.course, status='active')

        # Assignment
        self.assignment = Assignment.objects.create(
            course=self.course, organisation=self.org,
            title='Test Assignment', description='Do this',
            instructions='Follow the instructions',
            max_score=100, max_attempts=3,
            due_date=timezone.now() + timedelta(days=14),
            status='published', created_by=self.instructor,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class AssignmentListTests(AssignmentAPITestBase):
    """Test listing and creating assignments."""

    def test_instructor_can_list(self):
        self.auth(self.instructor)
        res = self.client.get('/api/v1/assignments/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data.get('results', res.data)), 1)

    def test_student_can_list_published(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/assignments/')
        self.assertEqual(res.status_code, 200)

    def test_instructor_can_create(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'New Assignment',
            'description': 'New desc',
            'max_score': 50,
            'status': 'draft',
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_student_cannot_create(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Hacked',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_instructor_can_publish(self):
        self.auth(self.instructor)
        assignment = Assignment.objects.create(
            course=self.course, organisation=self.org,
            title='Draft Assignment', max_score=100,
            status='draft', created_by=self.instructor,
        )
        res = self.client.post(f'/api/v1/assignments/{assignment.id}/publish/')
        self.assertEqual(res.status_code, 200)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, 'published')


class SubmissionTests(AssignmentAPITestBase):
    """Test submission workflow."""

    def setUp(self):
        super().setUp()
        self.submission = AssignmentSubmission.objects.create(
            assignment=self.assignment, student=self.student,
            attempt_number=1,
            content_data={'response': 'My answer'},
            status='draft',
        )

    def test_student_can_submit(self):
        self.auth(self.student)
        res = self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/submit/'
        )
        self.assertEqual(res.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, 'submitted')
        self.assertIsNotNone(self.submission.submitted_at)

    def test_student_cannot_submit_others(self):
        self.auth(self.other_student)
        res = self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/submit/'
        )
        # 404 because queryset doesn't include other students' submissions
        self.assertIn(res.status_code, [403, 404])

    def test_instructor_can_grade(self):
        # First submit
        self.auth(self.student)
        self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/submit/'
        )

        # Then grade
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/grade/',
            {'score': 85, 'feedback': 'Good work!'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, 'graded')
        self.assertEqual(float(self.submission.score), 85.0)

    def test_student_cannot_grade(self):
        self.auth(self.student)
        res = self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/grade/',
            {'score': 100}, format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_instructor_can_return_for_revision(self):
        self.auth(self.student)
        self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/submit/'
        )
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/assignments/submissions/{self.submission.id}/return_for_revision/',
            {'feedback': 'Please revise section 2'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, 'returned')

    def test_parent_can_view_child_submissions(self):
        from identity.models import ParentChildLink
        ParentChildLink.objects.create(
            parent_user=self.parent,
            student_user=self.student,
            is_verified=True, is_active=True, consent_given=True,
        )
        self.auth(self.parent)
        res = self.client.get('/api/v1/assignments/submissions/')
        self.assertEqual(res.status_code, 200)

    def test_cannot_submit_beyond_max_attempts(self):
        for i in range(3):
            AssignmentSubmission.objects.create(
                assignment=self.assignment, student=self.other_student,
                attempt_number=i + 1, content_data={},
            )
        self.auth(self.other_student)
        res = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(self.assignment.id),
        }, format='json')
        self.assertEqual(res.status_code, 403)

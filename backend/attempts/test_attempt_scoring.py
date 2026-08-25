"""
Tests for Attempt submission and server-side scoring.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from identity.models import User, RoleAssignment, Role
from organisations.models import Organisation
from courses.models import Course, Lesson, Enrolment, Programme
from activities.models import ActivityDefinition, ActivityQuestion
from attempts.models import Attempt, Response


class AttemptScoringTest(TestCase):
    """Test attempt submission and server-side scoring."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.student_role, _ = Role.objects.get_or_create(name='student')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')

        self.admin = User.objects.create_user(email='admin@test.com', password='testpass', supabase_uid='att-admin-uid', full_name='Admin')
        self.instructor = User.objects.create_user(email='instructor@test.com', password='testpass', supabase_uid='att-instructor-uid', full_name='Instructor')
        self.student = User.objects.create_user(email='student@test.com', password='testpass', supabase_uid='att-student-uid', full_name='Student')

        RoleAssignment.objects.create(user=self.admin, role=self.admin_role, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.instructor, role=self.instructor_role, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.student, role=self.student_role, organisation=self.org, status='active')

        self.programme = Programme.objects.create(name='Math', slug='math', organisation=self.org)
        self.course = Course.objects.create(
            title='Algebra', slug='algebra', programme=self.programme,
            organisation=self.org, instructor=self.instructor
        )
        self.lesson = Lesson.objects.create(
            title='Lesson 1', course=self.course, order=1, content_type='activity'
        )
        self.enrolment = Enrolment.objects.create(
            student=self.student, course=self.course, status='active'
        )

        self.activity = ActivityDefinition.objects.create(
            title='Quiz 1',
            lesson=self.lesson,
            organisation=self.org,
            created_by=self.instructor,
            activity_type='multiple_choice',
            status='published',
            pass_mark_percentage=60,
            max_attempts=3,
            show_correct_answers=True,
        )
        self.q1 = ActivityQuestion.objects.create(
            activity=self.activity,
            question_type='multiple_choice',
            prompt='What is 2+2?',
            options=[{'id': 'a', 'text': '3'}, {'id': 'b', 'text': '4'}, {'id': 'c', 'text': '5'}],
            correct_answer='b',
            points=10,
            order=1,
        )
        self.q2 = ActivityQuestion.objects.create(
            activity=self.activity,
            question_type='true_false',
            prompt='The earth is flat.',
            options=[{'id': 't', 'text': 'True'}, {'id': 'f', 'text': 'False'}],
            correct_answer='f',
            points=10,
            order=2,
        )

    def test_student_can_create_attempt(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post('/api/v1/attempts/', {
            'activity': str(self.activity.id),
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], 'not_started')

    def test_student_cannot_exceed_max_attempts(self):
        self.client.force_authenticate(user=self.student)
        # Create max attempts
        for _ in range(self.activity.max_attempts):
            self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        # This should fail
        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        self.assertIn(res.status_code, [400, 403])

    def test_instructor_cannot_create_attempt(self):
        self.client.force_authenticate(user=self.instructor)
        res = self.client.post('/api/v1/attempts/', {
            'activity': str(self.activity.id),
        })
        self.assertIn(res.status_code, [403, 400])

    def test_submit_attempt_scores_correctly(self):
        self.client.force_authenticate(user=self.student)

        # Create attempt
        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        attempt_id = res.data['id']

        # Create responses (answer both correctly)
        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q1.id),
            'answer_data': {'selected': 'b'},
        }, format='json')
        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q2.id),
            'answer_data': {'selected': 'f'},
        }, format='json')

        # Submit
        res = self.client.post(f'/api/v1/attempts/{attempt_id}/submit/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'submitted')
        self.assertEqual(float(res.data['score']), 20.0)
        self.assertEqual(float(res.data['percentage']), 100.0)
        self.assertTrue(res.data['passed'])

    def test_submit_attempt_partial_correct(self):
        self.client.force_authenticate(user=self.student)

        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        attempt_id = res.data['id']

        # Correct on q1, wrong on q2
        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q1.id),
            'answer_data': {'selected': 'b'},
        }, format='json')
        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q2.id),
            'answer_data': {'selected': 't'},
        }, format='json')

        res = self.client.post(f'/api/v1/attempts/{attempt_id}/submit/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(float(res.data['score']), 10.0)
        self.assertEqual(float(res.data['percentage']), 50.0)
        self.assertFalse(res.data['passed'])  # 50% < 60% pass mark

    def test_cannot_submit_already_submitted(self):
        self.client.force_authenticate(user=self.student)

        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        attempt_id = res.data['id']

        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q1.id),
            'answer_data': {'selected': 'b'},
        }, format='json')

        # Submit once
        self.client.post(f'/api/v1/attempts/{attempt_id}/submit/')

        # Try again
        res = self.client.post(f'/api/v1/attempts/{attempt_id}/submit/')
        self.assertEqual(res.status_code, 400)

    def test_get_result_after_submission(self):
        self.client.force_authenticate(user=self.student)

        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        attempt_id = res.data['id']

        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q1.id),
            'answer_data': {'selected': 'b'},
        }, format='json')

        self.client.post(f'/api/v1/attempts/{attempt_id}/submit/')

        res = self.client.get(f'/api/v1/attempts/{attempt_id}/result/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('attempt', res.data)
        self.assertIn('responses', res.data)
        self.assertGreater(len(res.data['responses']), 0)

    def test_letter_grade_calculation(self):
        self.client.force_authenticate(user=self.student)

        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        attempt_id = res.data['id']

        # Both correct = 100% -> A+
        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q1.id),
            'answer_data': {'selected': 'b'},
        }, format='json')
        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q2.id),
            'answer_data': {'selected': 'f'},
        }, format='json')

        res = self.client.post(f'/api/v1/attempts/{attempt_id}/submit/')
        self.assertEqual(res.data['letter_grade'], 'A+')

    def test_attempt_response_creates_audit_event(self):
        from audit.models import AuditEvent

        self.client.force_authenticate(user=self.student)

        res = self.client.post('/api/v1/attempts/', {'activity': str(self.activity.id)})
        attempt_id = res.data['id']

        events_before = AuditEvent.objects.count()

        self.client.post('/api/v1/attempts/responses/', {
            'attempt': attempt_id,
            'question': str(self.q1.id),
            'answer_data': {'selected': 'b'},
        }, format='json')

        events_after = AuditEvent.objects.count()
        self.assertGreater(events_after, events_before)

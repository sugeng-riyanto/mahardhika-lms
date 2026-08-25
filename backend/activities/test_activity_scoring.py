"""
Tests for Activity Definition RBAC and Activity Question endpoint.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from identity.models import User, RoleAssignment, Role
from organisations.models import Organisation
from courses.models import Course, Lesson, Enrolment, Programme
from activities.models import ActivityDefinition, ActivityQuestion


class ActivityRBACTest(TestCase):
    """Test RBAC for activity definitions."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')
        self.org_id = str(self.org.id)

        # Create roles
        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        # Create users
        self.admin = User.objects.create_user(email='admin@test.com', password='testpass', supabase_uid='act-admin-uid', full_name='Admin')
        self.instructor = User.objects.create_user(email='instructor@test.com', password='testpass', supabase_uid='act-instructor-uid', full_name='Instructor')
        self.student = User.objects.create_user(email='student@test.com', password='testpass', supabase_uid='act-student-uid', full_name='Student')

        # Assign roles
        RoleAssignment.objects.create(user=self.admin, role=self.admin_role, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.instructor, role=self.instructor_role, organisation=self.org, status='active')
        RoleAssignment.objects.create(user=self.student, role=self.student_role, organisation=self.org, status='active')

        # Create programme, course, lesson
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

        # Create activity with questions
        self.activity = ActivityDefinition.objects.create(
            title='Quiz 1',
            lesson=self.lesson,
            organisation=self.org,
            created_by=self.instructor,
            activity_type='multiple_choice',
            status='published',
            pass_mark_percentage=60,
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

    def test_admin_can_list_activities(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/activities/definitions/')
        self.assertEqual(res.status_code, 200)

    def test_student_can_list_published_activities(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/v1/activities/definitions/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data['results']), 1)

    def test_student_questions_hide_answers(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f'/api/v1/activities/definitions/{self.activity.id}/questions/')
        self.assertEqual(res.status_code, 200)
        for q in res.data:
            self.assertNotIn('correct_answer', q)
            self.assertNotIn('explanation', q)

    def test_instructor_questions_show_answers(self):
        self.client.force_authenticate(user=self.instructor)
        res = self.client.get(f'/api/v1/activities/definitions/{self.activity.id}/questions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)
        # Should have correct_answer
        self.assertIn('correct_answer', res.data[0])

    def test_instructor_can_create_activity(self):
        self.client.force_authenticate(user=self.instructor)
        res = self.client.post('/api/v1/activities/definitions/', {
            'title': 'New Quiz',
            'lesson': str(self.lesson.id),
            'organisation': self.org_id,
            'activity_type': 'multiple_choice',
            'pass_mark_percentage': 70,
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_student_cannot_create_activity(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post('/api/v1/activities/definitions/', {
            'title': 'Hacked Quiz',
            'lesson': str(self.lesson.id),
            'organisation': self.org_id,
            'activity_type': 'multiple_choice',
        }, format='json')
        self.assertIn(res.status_code, [403, 400])

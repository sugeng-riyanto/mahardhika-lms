"""Tests for branching scenario activity type."""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.utils import timezone
from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment
from activities.models import ActivityDefinition
from attempts.models import Attempt


@override_settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_SECRET_KEY='test-key', ALLOWED_HOSTS=['*'])
class BranchingScenarioTest(TestCase):
    """Test branching scenario CRUD and RBAC."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Test Org', slug='test-org')
        self.role_instructor = Role.objects.create(name='instructor', display_name='Instructor')
        self.role_student = Role.objects.create(name='student', display_name='Student')
        self.role_admin = Role.objects.create(name='admin', display_name='Admin')

        self.instructor = User.objects.create_user(
            email='inst@test.com', password='testpass123',
            supabase_uid='inst-branch-uid',
        )
        self.student = User.objects.create_user(
            email='stud@test.com', password='testpass123',
            supabase_uid='stud-branch-uid',
        )
        self.admin = User.objects.create_user(
            email='admin@test.com', password='testpass123',
            supabase_uid='admin-branch-uid',
        )

        for user, role in [
            (self.instructor, self.role_instructor),
            (self.student, self.role_student),
            (self.admin, self.role_admin),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org, status='active',
            )

        self.programme = Programme.objects.create(
            organisation=self.org, name='Test Programme', slug='test-prog',
            description='Test', level='shs',
        )
        self.course = Course.objects.create(
            programme=self.programme, organisation=self.org,
            title='Test Course', slug='test-course', description='Test',
            instructor=self.instructor, is_published=True,
        )
        self.lesson = Lesson.objects.create(
            course=self.course, title='Test Lesson', order=1,
            content_type='text', content_data={}, is_published=True,
        )
        self.enrolment = Enrolment.objects.create(
            student=self.student, course=self.course, status='active',
        )

        # Branching scenario graph
        self.graph = {
            'start_node': 'node_1',
            'nodes': {
                'node_1': {
                    'id': 'node_1',
                    'type': 'decision',
                    'title': 'Introduction',
                    'content': 'You find a mysterious door.',
                    'choices': [
                        {'id': 'a', 'text': 'Open it', 'next_node': 'node_2a'},
                        {'id': 'b', 'text': 'Walk away', 'next_node': 'outcome_fail'},
                    ],
                },
                'node_2a': {
                    'id': 'node_2a',
                    'type': 'decision',
                    'title': 'Inside the Room',
                    'content': 'You see a treasure chest.',
                    'choices': [
                        {'id': 'a', 'text': 'Open chest', 'next_node': 'outcome_success'},
                        {'id': 'b', 'text': 'Leave', 'next_node': 'outcome_partial'},
                    ],
                },
                'outcome_success': {
                    'id': 'outcome_success',
                    'type': 'outcome',
                    'title': 'Success!',
                    'content': 'You found the treasure!',
                    'outcome': 'success',
                    'score': 100,
                },
                'outcome_partial': {
                    'id': 'outcome_partial',
                    'type': 'outcome',
                    'title': 'Partial',
                    'content': 'You could have done better.',
                    'outcome': 'partial',
                    'score': 50,
                },
                'outcome_fail': {
                    'id': 'outcome_fail',
                    'type': 'outcome',
                    'title': 'Failed',
                    'content': 'You missed the opportunity.',
                    'outcome': 'failure',
                    'score': 0,
                },
            },
        }

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_instructor_can_create_branching_scenario(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
            'status': 'published',
        }, format='json')
        self.assertIn(res.status_code, [200, 201])
        self.assertEqual(res.data['activity_type'], 'branching_scenario')

    def test_student_can_list_branching_scenarios(self):
        self.auth(self.instructor)
        self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
            'status': 'published',
        }, format='json')

        self.auth(self.student)
        res = self.client.get('/api/v1/activities/definitions/')
        self.assertEqual(res.status_code, 200)
        types = [a['activity_type'] for a in res.data['results']]
        self.assertIn('branching_scenario', types)

    def test_branching_scenario_graph_is_stored(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        content = res.data['content']
        self.assertEqual(content['start_node'], 'node_1')
        self.assertEqual(len(content['nodes']), 5)
        self.assertEqual(content['nodes']['outcome_success']['score'], 100)

    def test_student_can_create_attempt_for_branching_scenario(self):
        self.auth(self.instructor)
        act = self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
            'status': 'published',
        }, format='json').data

        self.auth(self.student)
        res = self.client.post('/api/v1/attempts/', {
            'activity': act['id'],
        }, format='json')
        self.assertIn(res.status_code, [200, 201])

    def test_save_path_endpoint(self):
        self.auth(self.instructor)
        act = self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
            'status': 'published',
        }, format='json').data

        self.auth(self.student)
        attempt = self.client.post('/api/v1/attempts/', {
            'activity': act['id'],
        }, format='json').data

        res = self.client.post(f'/api/v1/attempts/{attempt["id"]}/save-path/', {
            'path': [
                {'node_id': 'node_1', 'choice_id': 'a'},
                {'node_id': 'node_2a', 'choice_id': 'a'},
            ],
            'score': 100,
            'max_score': 100,
            'outcome': 'success',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'submitted')
        self.assertEqual(float(res.data['score']), 100.0)

    def test_different_outcome_scores(self):
        """Test that different paths produce different scores."""
        self.auth(self.instructor)
        act = self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
            'status': 'published',
            'max_attempts': 5,
        }, format='json').data

        self.auth(self.student)

        # Path 1: success path (score 100)
        attempt1 = self.client.post('/api/v1/attempts/', {
            'activity': act['id'],
        }, format='json').data
        res1 = self.client.post(f'/api/v1/attempts/{attempt1["id"]}/save-path/', {
            'path': [
                {'node_id': 'node_1', 'choice_id': 'a'},
                {'node_id': 'node_2a', 'choice_id': 'a'},
            ],
            'score': 100, 'max_score': 100, 'outcome': 'success',
        }, format='json')
        self.assertEqual(float(res1.data['score']), 100.0)

        # Path 2: partial path (score 50)
        attempt2 = self.client.post('/api/v1/attempts/', {
            'activity': act['id'],
        }, format='json').data
        res2 = self.client.post(f'/api/v1/attempts/{attempt2["id"]}/save-path/', {
            'path': [
                {'node_id': 'node_1', 'choice_id': 'a'},
                {'node_id': 'node_2a', 'choice_id': 'b'},
            ],
            'score': 50, 'max_score': 100, 'outcome': 'partial',
        }, format='json')
        self.assertEqual(float(res2.data['score']), 50.0)

    def test_instructor_view_shows_graph(self):
        self.auth(self.instructor)
        act = self.client.post('/api/v1/activities/definitions/', {
            'organisation': str(self.org.id),
            'lesson': str(self.lesson.id),
            'title': 'Mystery Door',
            'activity_type': 'branching_scenario',
            'content': self.graph,
        }, format='json').data

        res = self.client.get(f'/api/v1/activities/definitions/{act["id"]}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['activity_type'], 'branching_scenario')
        self.assertIn('start_node', res.data['content'])

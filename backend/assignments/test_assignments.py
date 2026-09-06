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

    def _create_mcq_assignment(self, task_type='mcq', status='published'):
        payload = {
            'course': str(self.course.id),
            'title': 'Quiz 1',
            'task_type': task_type,
            'max_score': 100,
            'status': status,
            'questions': [
                {
                    'question_type': 'multiple_choice',
                    'prompt': 'What is 2+2?',
                    'options': [{'id': 'a', 'text': '3'}, {'id': 'b', 'text': '4'}, {'id': 'c', 'text': '5'}],
                    'correct_answer': ['b'],
                    'points': 5,
                },
                {
                    'question_type': 'true_false',
                    'prompt': 'The sky is blue.',
                    'options': [{'id': 'a', 'text': 'True'}, {'id': 'b', 'text': 'False'}],
                    'correct_answer': ['a'],
                    'points': 5,
                },
            ],
        }
        self.auth(self.instructor)
        return self.client.post('/api/v1/assignments/', payload, format='json')


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


class AssignmentTaskTypeTests(AssignmentAPITestBase):
    """Instructors can assign MCQ, essay, and combined tasks."""

    def test_instructor_creates_mcq_with_questions(self):
        res = self._create_mcq_assignment()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['task_type'], 'mcq')
        self.assertEqual(len(res.data['questions']), 2)
        self.assertEqual(res.data['mcq_total_points'], 10)

    def test_instructor_creates_combined_with_essay_link(self):
        from essays.models import EssayQuestion
        essay = EssayQuestion.objects.create(
            title='Essay 1', marks=20, status='published', course=self.course,
            created_by=self.instructor,
        )
        self.auth(self.instructor)
        res = self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Combined Task',
            'task_type': 'combined',
            'max_score': 100,
            'status': 'published',
            'questions': [{
                'question_type': 'multiple_choice',
                'prompt': 'Q?',
                'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                'correct_answer': ['a'],
                'points': 4,
            }],
            'essay_questions': [str(essay.id)],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(len(res.data['essay_questions']), 1)
        self.assertEqual(res.data['essay_question_titles'][0]['title'], 'Essay 1')

    def test_student_never_sees_correct_answers(self):
        self._create_mcq_assignment()
        self.auth(self.student)
        res = self.client.get('/api/v1/assignments/')
        item = next(a for a in (res.data.get('results', res.data)) if a.get('task_type') == 'mcq')
        for q in item['questions']:
            self.assertNotIn('correct_answer', q)

    def test_mcq_submission_auto_graded(self):
        self._create_mcq_assignment()
        self.auth(self.student)
        assignment = Assignment.objects.get(title='Quiz 1')
        res = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(assignment.id),
            'content_data': {'mcq_answers': {
                str(assignment.questions.get(order=0).id): 'b',
                str(assignment.questions.get(order=1).id): 'b',  # wrong
            }},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], 'graded')
        self.assertEqual(float(res.data['score']), 50.0)  # 5/10 pts
        self.assertEqual(res.data['content_data']['mcq_score'], 5)
        self.assertEqual(res.data['content_data']['mcq_total'], 10)

    def test_mcq_submission_requires_answers(self):
        self._create_mcq_assignment()
        self.auth(self.student)
        assignment = Assignment.objects.get(title='Quiz 1')
        res = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(assignment.id),
            'content_data': {},
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_combined_submission_stores_mcq_score_not_finalised(self):
        from essays.models import EssayQuestion
        EssayQuestion.objects.create(
            title='Essay 1', marks=20, status='published', course=self.course,
            created_by=self.instructor,
        )
        self.auth(self.instructor)
        res = self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Combined 2',
            'task_type': 'combined',
            'max_score': 100,
            'status': 'published',
            'questions': [{
                'question_type': 'multiple_choice',
                'prompt': 'Q?',
                'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                'correct_answer': ['a'],
                'points': 4,
            }],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        assignment = Assignment.objects.get(title='Combined 2')
        self.auth(self.student)
        qid = str(assignment.questions.first().id)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(assignment.id),
            'content_data': {'mcq_answers': {qid: 'a'}},
        }, format='json')
        self.assertEqual(sub.status_code, 201, sub.data)
        self.assertEqual(sub.data['status'], 'submitted')  # essay part still manual
        self.assertEqual(sub.data['content_data']['mcq_score'], 4)

    def test_submission_list_filters_by_assignment(self):
        other = Assignment.objects.create(
            course=self.course, organisation=self.org,
            title='Other Assignment', max_score=100, status='published',
            created_by=self.instructor,
        )
        AssignmentSubmission.objects.create(
            assignment=other, student=self.student,
            attempt_number=1, content_data={'text': 'for other task'},
            status='submitted',
        )
        AssignmentSubmission.objects.create(
            assignment=self.assignment, student=self.student,
            attempt_number=1, content_data={'text': 'for this task'},
            status='submitted',
        )
        self.auth(self.student)
        res = self.client.get(
            f'/api/v1/assignments/submissions/?assignment={self.assignment.id}'
        )
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['content_data']['text'], 'for this task')



    def test_question_page_saved_and_returned(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Exam with pages',
            'task_type': 'exam',
            'max_score': 100,
            'status': 'published',
            'questions': [
                {
                    'question_type': 'multiple_choice',
                    'prompt': 'P1 Q',
                    'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                    'correct_answer': ['a'],
                    'points': 1,
                    'page': 1,
                },
                {
                    'question_type': 'multiple_choice',
                    'prompt': 'P2 Q',
                    'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                    'correct_answer': ['b'],
                    'points': 1,
                    'page': 2,
                },
            ],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        qs = Assignment.objects.get(title='Exam with pages').questions.all()
        self.assertEqual(qs.get(prompt='P1 Q').page, 1)
        self.assertEqual(qs.get(prompt='P2 Q').page, 2)
        self.auth(self.instructor)
        item = self.client.get(f'/api/v1/assignments/{Assignment.objects.get(title="Exam with pages").id}/')
        pages = [q['page'] for q in item.data['questions']]
        self.assertEqual(pages, [1, 2])

    def test_mcq_results_include_key_for_review(self):
        self._create_mcq_assignment()
        self.auth(self.student)
        assignment = Assignment.objects.get(title='Quiz 1')
        res = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(assignment.id),
            'content_data': {'mcq_answers': {
                str(assignment.questions.get(order=0).id): 'b',
                str(assignment.questions.get(order=1).id): 'a',
            }},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        results = res.data['content_data']['mcq_results']
        self.assertEqual(results[0]['key'], ['b'])
        self.assertEqual(results[1]['key'], ['a'])
        self.assertTrue(results[0]['correct'])


class AssignmentExamTests(AssignmentAPITestBase):
    """Exam tasks: PDF pages on the assignment, answer key auto-grading."""

    def _create_exam(self):
        self.auth(self.instructor)
        return self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Midterm Exam',
            'task_type': 'exam',
            'max_score': 100,
            'status': 'published',
            'exam_pdf_name': 'midterm.pdf',
            'exam_pages': ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'],
            'questions': [
                {
                    'question_type': 'multiple_choice',
                    'prompt': '1. What is 2+2?',
                    'options': [{'id': 'a', 'text': '3'}, {'id': 'b', 'text': '4'}, {'id': 'c', 'text': '5'}],
                    'correct_answer': ['b'],
                    'points': 5,
                },
                {
                    'question_type': 'multiple_choice',
                    'prompt': '2. Capital of Indonesia?',
                    'options': [{'id': 'a', 'text': 'Jakarta'}, {'id': 'b', 'text': 'Bandung'}],
                    'correct_answer': ['a'],
                    'points': 5,
                },
            ],
        }, format='json')

    def test_instructor_creates_exam_with_pages(self):
        res = self._create_exam()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['task_type'], 'exam')
        self.assertEqual(res.data['exam_pdf_name'], 'midterm.pdf')
        self.assertEqual(len(res.data['exam_pages']), 2)
        self.assertEqual(res.data['exam_page_count'], 2)

    def test_list_does_not_send_page_images(self):
        self._create_exam()
        self.auth(self.student)
        res = self.client.get('/api/v1/assignments/')
        self.assertEqual(res.status_code, 200)
        item = next(a for a in (res.data.get('results', res.data)) if a.get('task_type') == 'exam')
        self.assertEqual(item['exam_pages'], [])
        self.assertEqual(item['exam_page_count'], 2)

    def test_exam_submission_auto_graded_from_key(self):
        self._create_exam()
        self.auth(self.student)
        assignment = Assignment.objects.get(title='Midterm Exam')
        q1, q2 = list(assignment.questions.order_by('order'))
        res = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(assignment.id),
            'content_data': {'mcq_answers': {
                str(q1.id): 'b',   # correct
                str(q2.id): 'b',   # wrong
            }},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], 'graded')
        self.assertEqual(float(res.data['score']), 50.0)
        self.assertEqual(res.data['content_data']['mcq_score'], 5)


class AssignmentRbacWriteTests(AssignmentAPITestBase):
    """CRUD write enforcement: only instructor+ may edit/delete assignments."""

    def test_student_cannot_edit_assignment(self):
        self.auth(self.student)
        res = self.client.patch(
            f'/api/v1/assignments/{self.assignment.id}/',
            {'title': 'Hacked'}, format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_delete_assignment(self):
        self.auth(self.student)
        res = self.client.delete(f'/api/v1/assignments/{self.assignment.id}/')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Assignment.objects.filter(id=self.assignment.id).exists())

    def test_parent_cannot_delete_assignment(self):
        self.auth(self.parent)
        res = self.client.delete(f'/api/v1/assignments/{self.assignment.id}/')
        # 403 (rights denied) or 404 (queryset hides it) — both deny
        self.assertIn(res.status_code, (403, 404))

    def test_student_cannot_edit_question_key(self):
        self.auth(self.instructor)
        self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Key Quiz',
            'task_type': 'mcq',
            'status': 'published',
            'questions': [{
                'question_type': 'multiple_choice',
                'prompt': 'Q?',
                'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                'correct_answer': ['a'],
                'points': 1,
            }],
        }, format='json')
        quiz = Assignment.objects.get(title='Key Quiz')
        qid = str(quiz.questions.first().id)
        self.auth(self.student)
        res = self.client.patch(f'/api/v1/assignments/{quiz.id}/', {
            'questions': [{
                'question_type': 'multiple_choice',
                'prompt': 'Q?',
                'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                'correct_answer': ['b'],  # student tries to change the key
                'points': 1,
            }],
        }, format='json')
        self.assertEqual(res.status_code, 403)
        # Key unchanged
        self.assertEqual(quiz.questions.first().correct_answer, ['a'])

    def test_student_can_delete_own_draft_submission(self):
        self.auth(self.student)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(self.assignment.id),
            'content_data': {'response': 'draft work'},
        }, format='json')
        self.assertEqual(sub.status_code, 201, sub.data)
        res = self.client.delete(f"/api/v1/assignments/submissions/{sub.data['id']}/")
        self.assertEqual(res.status_code, 204)

    def test_student_cannot_delete_graded_submission(self):
        self.auth(self.instructor)
        self.client.post('/api/v1/assignments/', {
            'course': str(self.course.id),
            'title': 'Graded Quiz',
            'task_type': 'mcq',
            'status': 'published',
            'questions': [{
                'question_type': 'multiple_choice',
                'prompt': 'Q?',
                'options': [{'id': 'a', 'text': 'X'}, {'id': 'b', 'text': 'Y'}],
                'correct_answer': ['a'],
                'points': 5,
            }],
        }, format='json')
        quiz = Assignment.objects.get(title='Graded Quiz')
        qid = str(quiz.questions.first().id)
        self.auth(self.student)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(quiz.id),
            'content_data': {'mcq_answers': {qid: 'a'}},
        }, format='json')
        self.assertEqual(sub.status_code, 201, sub.data)
        self.assertEqual(sub.data['status'], 'graded')
        res = self.client.delete(f"/api/v1/assignments/submissions/{sub.data['id']}/")
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_delete_others_submission(self):
        self.auth(self.student)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(self.assignment.id),
            'content_data': {'response': 'mine'},
        }, format='json')
        self.auth(self.other_student)
        res = self.client.delete(f"/api/v1/assignments/submissions/{sub.data['id']}/")
        # 403 (rights denied) or 404 (queryset hides it) — both deny
        self.assertIn(res.status_code, (403, 404))


class SubmissionVerifyHashTests(AssignmentAPITestBase):
    """verify_hash generation and the public verification endpoint."""

    def test_verify_hash_generated_and_exposed(self):
        self.auth(self.student)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(self.assignment.id),
            'content_data': {'response': 'my work'},
        }, format='json')
        self.assertEqual(sub.status_code, 201, sub.data)
        self.assertTrue(sub.data.get('verify_hash'))
        self.assertEqual(len(sub.data['verify_hash']), 32)
        stored = AssignmentSubmission.objects.get(id=sub.data['id'])
        self.assertEqual(stored.verify_hash, sub.data['verify_hash'])

    def test_verify_hash_stable_across_updates(self):
        self.auth(self.student)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(self.assignment.id),
            'content_data': {'response': 'v1'},
        }, format='json')
        h1 = sub.data['verify_hash']
        self.auth(self.instructor)
        self.client.post(f"/api/v1/assignments/submissions/{sub.data['id']}/submit/")
        updated = AssignmentSubmission.objects.get(id=sub.data['id'])
        self.assertEqual(updated.verify_hash, h1)

    def test_public_verify_returns_snapshot_without_key(self):
        self._create_mcq_assignment()
        self.auth(self.student)
        assignment = Assignment.objects.get(title='Quiz 1')
        qid = str(assignment.questions.first().id)
        sub = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': str(assignment.id),
            'content_data': {'mcq_answers': {qid: 'b'}},
        }, format='json')
        self.assertEqual(sub.status_code, 201, sub.data)
        # No auth — public verification
        self.client.force_authenticate(user=None)
        res = self.client.get(f"/api/v1/assignments/submissions/verify/{sub.data['verify_hash']}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['valid'])
        self.assertEqual(res.data['assignment_title'], 'Quiz 1')
        self.assertEqual(res.data['student_email'], 'student@test.com')
        self.assertEqual(float(res.data['score']), 50.0)
        # The snapshot must never expose answers or the answer key
        body = str(res.data)
        self.assertNotIn('correct_answer', body)
        self.assertNotIn('mcq_answers', body)
        self.assertNotIn('mcq_results', body)

    def test_public_verify_unknown_hash_404(self):
        self.client.force_authenticate(user=None)
        res = self.client.get('/api/v1/assignments/submissions/verify/deadbeefdeadbeefdeadbeefdeadbeef/')
        self.assertEqual(res.status_code, 404)
        self.assertFalse(res.data['valid'])

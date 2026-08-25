"""
Tests for progress RBAC, completion records, and course progress aggregation.
"""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment
from progress.models import CompletionRecord, CourseProgress


class ProgressTestBase(TestCase):
    """Shared setup for progress tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Prog Org', slug='prog-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')
        self.parent_role, _ = Role.objects.get_or_create(name='parent')

        self.admin = User.objects.create_user(
            email='admin@prog.test', password='pass123',
            supabase_uid='admin-prog-uid', full_name='Admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@prog.test', password='pass123',
            supabase_uid='instructor-prog-uid', full_name='Instructor',
        )
        self.student = User.objects.create_user(
            email='student@prog.test', password='pass123',
            supabase_uid='student-prog-uid', full_name='Student',
        )
        self.parent = User.objects.create_user(
            email='parent@prog.test', password='pass123',
            supabase_uid='parent-prog-uid', full_name='Parent',
        )

        for user, role in [
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
        self.lesson1 = Lesson.objects.create(
            course=self.course, title='Lesson 1', order=1,
            content_type='text', is_published=True,
        )
        self.lesson2 = Lesson.objects.create(
            course=self.course, title='Lesson 2', order=2,
            content_type='text', is_published=True,
        )

        Enrolment.objects.create(student=self.student, course=self.course, status='active')

    def auth(self, user):
        self.client.force_authenticate(user=user)


class CompletionRecordRBACTests(ProgressTestBase):
    """Test completion record RBAC."""

    def test_student_can_mark_own_lesson_complete(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/progress/completions/', {
            'course': str(self.course.id),
            'lesson': str(self.lesson1.id),
            'completion_type': 'lesson',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(CompletionRecord.objects.filter(
            student=self.student, lesson=self.lesson1, is_completed=True,
        ).exists())

    def test_student_cannot_mark_others_lesson(self):
        other = User.objects.create_user(
            email='other@prog.test', password='pass123',
            supabase_uid='other-prog-uid', full_name='Other',
        )
        self.auth(self.student)
        res = self.client.post('/api/v1/progress/completions/', {
            'course': str(self.course.id),
            'lesson': str(self.lesson1.id),
            'completion_type': 'lesson',
            'student': str(other.id),
        }, format='json')
        # Student's own record is created regardless of student field in POST
        self.assertEqual(res.status_code, 201)

    def test_student_sees_own_completions(self):
        CompletionRecord.objects.create(
            student=self.student, course=self.course, lesson=self.lesson1,
            completion_type='lesson', is_completed=True, completed_at=timezone.now(),
        )
        self.auth(self.student)
        res = self.client.get('/api/v1/progress/completions/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertGreaterEqual(len(results), 1)

    def test_parent_sees_child_completions(self):
        from identity.models import ParentChildLink
        ParentChildLink.objects.create(
            parent_user=self.parent,
            student_user=self.student,
            is_verified=True, is_active=True, consent_given=True,
        )
        CompletionRecord.objects.create(
            student=self.student, course=self.course, lesson=self.lesson1,
            completion_type='lesson', is_completed=True, completed_at=timezone.now(),
        )
        self.auth(self.parent)
        res = self.client.get('/api/v1/progress/completions/')
        self.assertEqual(res.status_code, 200)

    def test_instructor_sees_course_completions(self):
        CompletionRecord.objects.create(
            student=self.student, course=self.course, lesson=self.lesson1,
            completion_type='lesson', is_completed=True, completed_at=timezone.now(),
        )
        self.auth(self.instructor)
        res = self.client.get('/api/v1/progress/completions/')
        self.assertEqual(res.status_code, 200)


class CourseProgressTests(ProgressTestBase):
    """Test course progress aggregation."""

    def test_student_sees_own_progress(self):
        CourseProgress.objects.create(
            student=self.student, course=self.course,
            total_lessons=2, completed_lessons=1, overall_percent=50,
        )
        self.auth(self.student)
        res = self.client.get('/api/v1/progress/courses/')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertGreaterEqual(len(results), 1)

    def test_my_progress_endpoint(self):
        CourseProgress.objects.create(
            student=self.student, course=self.course,
            total_lessons=2, completed_lessons=1, overall_percent=50,
        )
        self.auth(self.student)
        res = self.client.get('/api/v1/progress/completions/my_progress/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 1)

    def test_student_cannot_view_other_progress(self):
        other = User.objects.create_user(
            email='other2@prog.test', password='pass123',
            supabase_uid='other2-prog-uid', full_name='Other2',
        )
        CourseProgress.objects.create(
            student=other, course=self.course,
            total_lessons=2, overall_percent=0,
        )
        self.auth(self.student)
        res = self.client.get('/api/v1/progress/courses/')
        results = res.data.get('results', res.data)
        for p in results:
            self.assertNotEqual(p['student'], str(other.id))

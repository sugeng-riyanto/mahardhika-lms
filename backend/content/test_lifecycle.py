"""
Tests for content lifecycle workflow, transitions, and RBAC.
"""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Enrolment
from content.models import ContentItem, ContentStatusLog


class LifecycleTestBase(TestCase):
    """Shared setup for lifecycle tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Lifecycle Org', slug='lifecycle-org')

        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')

        self.admin = User.objects.create_user(
            email='admin@lifecycle.test', password='pass',
            supabase_uid='uid-lc-admin',
        )
        self.instructor = User.objects.create_user(
            email='instructor@lifecycle.test', password='pass',
            supabase_uid='uid-lc-instructor',
        )
        self.other_instructor = User.objects.create_user(
            email='other-instructor@lifecycle.test', password='pass',
            supabase_uid='uid-lc-other-inst',
        )
        self.student = User.objects.create_user(
            email='student@lifecycle.test', password='pass',
            supabase_uid='uid-lc-student',
        )

        for user, role in [
            (self.admin, self.admin_role),
            (self.instructor, self.instructor_role),
            (self.other_instructor, self.instructor_role),
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

        self.draft_content = ContentItem.objects.create(
            organisation=self.org, course=self.course,
            title='Draft Notes', content_type='document',
            uploaded_by=self.instructor, status='draft',
        )
        self.review_content = ContentItem.objects.create(
            organisation=self.org, course=self.course,
            title='Review Slides', content_type='document',
            uploaded_by=self.instructor, status='review',
            submitted_for_review_at=timezone.now(),
        )
        self.published_content = ContentItem.objects.create(
            organisation=self.org, course=self.course,
            title='Published Video', content_type='video',
            uploaded_by=self.instructor, status='published',
            published_at=timezone.now(),
        )
        self.archived_content = ContentItem.objects.create(
            organisation=self.org, course=self.course,
            title='Old Materials', content_type='document',
            uploaded_by=self.instructor, status='archived',
            archived_at=timezone.now(),
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class ContentStatusLogTest(TestCase):
    """Test the status log model."""

    def setUp(self):
        self.org = Organisation.objects.create(name='Log Org', slug='log-org')
        self.user = User.objects.create_user(
            email='user@log.test', password='pass', supabase_uid='uid-log',
        )
        self.content = ContentItem.objects.create(
            organisation=self.org, title='Test', content_type='document',
            uploaded_by=self.user, status='draft',
        )

    def test_log_creation(self):
        log = ContentStatusLog.objects.create(
            content_item=self.content,
            action='created',
            to_status='draft',
            performed_by=self.user,
        )
        self.assertEqual(log.from_status, '')
        self.assertEqual(log.to_status, 'draft')
        self.assertEqual(log.performed_by, self.user)

    def test_log_with_notes(self):
        log = ContentStatusLog.objects.create(
            content_item=self.content,
            action='submitted_for_review',
            from_status='draft',
            to_status='review',
            notes='Ready for review',
            performed_by=self.user,
        )
        self.assertEqual(log.notes, 'Ready for review')

    def test_logs_ordered_by_created_at(self):
        ContentStatusLog.objects.create(
            content_item=self.content, action='created',
            to_status='draft', performed_by=self.user,
        )
        ContentStatusLog.objects.create(
            content_item=self.content, action='submitted_for_review',
            from_status='draft', to_status='review', performed_by=self.user,
        )
        logs = self.content.status_logs.all()
        self.assertEqual(logs.count(), 2)
        actions = [l.action for l in logs]
        self.assertIn('created', actions)
        self.assertIn('submitted_for_review', actions)


class SubmitForReviewTest(LifecycleTestBase):
    """Test draft → review transition."""

    def test_instructor_submits_own_draft(self):
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/submit-for-review/',
            {'notes': 'Ready for review'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.draft_content.refresh_from_db()
        self.assertEqual(self.draft_content.status, 'review')
        self.assertIsNotNone(self.draft_content.submitted_for_review_at)

    def test_instructor_cannot_submit_others_draft(self):
        self.auth(self.other_instructor)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/submit-for-review/',
            format='json',
        )
        # 404 because queryset filtering hides content from other instructors
        self.assertIn(res.status_code, [403, 404])

    def test_cannot_submit_non_draft(self):
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/content/{self.published_content.id}/submit-for-review/',
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_admin_can_submit_any(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/submit-for-review/',
            format='json',
        )
        self.assertEqual(res.status_code, 200)

    def test_student_cannot_submit(self):
        self.auth(self.student)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/submit-for-review/',
            format='json',
        )
        # 404 because student queryset only shows published content
        self.assertIn(res.status_code, [403, 404])

    def test_creates_status_log(self):
        self.auth(self.instructor)
        self.client.post(
            f'/api/v1/content/{self.draft_content.id}/submit-for-review/',
            {'notes': 'Log this'}, format='json',
        )
        log = ContentStatusLog.objects.filter(
            content_item=self.draft_content, action='submitted_for_review',
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.from_status, 'draft')
        self.assertEqual(log.to_status, 'review')
        self.assertEqual(log.notes, 'Log this')


class ApproveTest(LifecycleTestBase):
    """Test review → published transition."""

    def test_admin_approves(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.review_content.id}/approve/',
            {'notes': 'Looks good'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.review_content.refresh_from_db()
        self.assertEqual(self.review_content.status, 'published')
        self.assertIsNotNone(self.review_content.published_at)
        self.assertEqual(self.review_content.reviewed_by, self.admin)
        self.assertEqual(self.review_content.version, 2)

    def test_instructor_cannot_approve(self):
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/content/{self.review_content.id}/approve/',
            format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_cannot_approve_non_review(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/approve/',
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_creates_status_log(self):
        self.auth(self.admin)
        self.client.post(
            f'/api/v1/content/{self.review_content.id}/approve/',
            {'notes': 'Approved'}, format='json',
        )
        log = ContentStatusLog.objects.filter(
            content_item=self.review_content, action='published',
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.from_status, 'review')
        self.assertEqual(log.to_status, 'published')


class ReturnForRevisionTest(LifecycleTestBase):
    """Test review → draft transition."""

    def test_admin_returns(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.review_content.id}/return-for-revision/',
            {'notes': 'Needs more examples'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.review_content.refresh_from_db()
        self.assertEqual(self.review_content.status, 'draft')
        self.assertIsNone(self.review_content.submitted_for_review_at)

    def test_cannot_return_non_review(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/return-for-revision/',
            format='json',
        )
        self.assertEqual(res.status_code, 400)


class ArchiveTest(LifecycleTestBase):
    """Test any → archived transition."""

    def test_admin_archives_published(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.published_content.id}/archive/',
            {'notes': 'Outdated'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.published_content.refresh_from_db()
        self.assertEqual(self.published_content.status, 'archived')
        self.assertIsNotNone(self.published_content.archived_at)

    def test_admin_archives_draft(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.draft_content.id}/archive/',
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.draft_content.refresh_from_db()
        self.assertEqual(self.draft_content.status, 'archived')

    def test_instructor_cannot_archive(self):
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/content/{self.published_content.id}/archive/',
            format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_cannot_archive_already_archived(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.archived_content.id}/archive/',
            format='json',
        )
        self.assertEqual(res.status_code, 400)


class RevertToDraftTest(LifecycleTestBase):
    """Test archived → draft transition."""

    def test_admin_reverts(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.archived_content.id}/revert-to-draft/',
            {'notes': 'Reviving'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.archived_content.refresh_from_db()
        self.assertEqual(self.archived_content.status, 'draft')
        self.assertIsNone(self.archived_content.archived_at)
        self.assertEqual(self.archived_content.version, 2)

    def test_cannot_revert_non_archived(self):
        self.auth(self.admin)
        res = self.client.post(
            f'/api/v1/content/{self.published_content.id}/revert-to-draft/',
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_instructor_cannot_revert(self):
        self.auth(self.instructor)
        res = self.client.post(
            f'/api/v1/content/{self.archived_content.id}/revert-to-draft/',
            format='json',
        )
        self.assertEqual(res.status_code, 403)


class StudentVisibilityTest(LifecycleTestBase):
    """Test that students only see published content."""

    def test_student_sees_published(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/content/')
        results = res.data.get('results', res.data)
        titles = [c['title'] for c in results]
        self.assertIn('Published Video', titles)

    def test_student_does_not_see_draft(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/content/')
        results = res.data.get('results', res.data)
        titles = [c['title'] for c in results]
        self.assertNotIn('Draft Notes', titles)

    def test_student_does_not_see_review(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/content/')
        results = res.data.get('results', res.data)
        titles = [c['title'] for c in results]
        self.assertNotIn('Review Slides', titles)

    def test_student_does_not_see_archived(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/content/')
        results = res.data.get('results', res.data)
        titles = [c['title'] for c in results]
        self.assertNotIn('Old Materials', titles)


class FullWorkflowTest(LifecycleTestBase):
    """Test a complete lifecycle: draft → review → published → archived → draft."""

    def test_full_lifecycle(self):
        # Create new content
        self.auth(self.instructor)
        res = self.client.post('/api/v1/content/', {
            'title': 'Lifecycle Test',
            'content_type': 'document',
            'course': str(self.course.id),
            'organisation': str(self.org.id),
        }, format='json')
        self.assertEqual(res.status_code, 201, f'Create failed: {res.data}')
        content_id = res.data['id']

        # Submit for review
        self.auth(self.instructor)
        res = self.client.post(f'/api/v1/content/{content_id}/submit-for-review/', format='json')
        self.assertEqual(res.data['status'], 'review')

        # Approve and publish
        self.auth(self.admin)
        res = self.client.post(f'/api/v1/content/{content_id}/approve/', format='json')
        self.assertEqual(res.data['status'], 'published')

        # Archive
        res = self.client.post(f'/api/v1/content/{content_id}/archive/', format='json')
        self.assertEqual(res.data['status'], 'archived')

        # Revert to draft
        res = self.client.post(f'/api/v1/content/{content_id}/revert-to-draft/', format='json')
        self.assertEqual(res.data['status'], 'draft')

        # Verify audit trail
        logs = ContentStatusLog.objects.filter(
            content_item_id=content_id,
        ).order_by('created_at')
        actions = [l.action for l in logs]
        self.assertIn('created', actions)
        self.assertIn('submitted_for_review', actions)
        self.assertIn('published', actions)
        self.assertIn('archived', actions)
        self.assertIn('reverted', actions)

"""
Content library with lifecycle workflow and RBAC.

States: draft → review → published → archived

Transitions:
    draft → review        (instructor submits for review)
    review → published    (admin/owner approves and publishes)
    review → draft        (admin/owner returns for revision)
    published → archived  (admin/owner archives)
    archived → draft      (admin/owner reverts to draft)
    draft → archived      (admin/owner archives directly)

Roles:
    Owner/Admin:  full lifecycle control, review/publish/archive
    Instructor:   create content, submit for review, edit own drafts
    Student:      read published content in enrolled courses only
    Parent:       read published content in child's enrolled courses
"""
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from content.models import ContentItem, ContentStatusLog
from courses.models import Enrolment
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation
)


class ContentStatusLogSerializer(serializers.ModelSerializer):
    performed_by_email = serializers.CharField(source='performed_by.email', read_only=True, default=None)

    class Meta:
        model = ContentStatusLog
        fields = ['id', 'action', 'from_status', 'to_status', 'notes', 'performed_by', 'performed_by_email', 'created_at']
        read_only_fields = fields


class ContentItemSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.CharField(source='uploaded_by.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, default=None)
    reviewed_by_email = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)
    status_logs = ContentStatusLogSerializer(many=True, read_only=True)

    class Meta:
        model = ContentItem
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'uploaded_by',
            'submitted_for_review_at', 'published_at', 'archived_at',
            'reviewed_by', 'review_notes', 'version', 'status_logs',
        ]


class ContentItemViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Content library management with lifecycle workflow."""
    audit_resource_type = 'content_item'
    serializer_class = ContentItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['content_type', 'course', 'status']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = ContentItem.objects.select_related('uploaded_by', 'course', 'reviewed_by')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                qs = qs.filter(organisation=org)
            return qs

        if 'instructor' in roles:
            # Instructors see their own content in any status
            return qs.filter(uploaded_by=user)

        if 'student' in roles:
            # Students only see published content in enrolled courses
            enrolled_course_ids = Enrolment.objects.filter(
                student=user, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(course_id__in=enrolled_course_ids, status='published')

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            enrolled_course_ids = Enrolment.objects.filter(
                student_id__in=child_ids, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(course_id__in=enrolled_course_ids, status='published')

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can upload content.')
        org = get_user_organisation(user)
        content = serializer.save(uploaded_by=user, organisation=org)
        ContentStatusLog.objects.create(
            content_item=content,
            action='created',
            to_status='draft',
            performed_by=user,
        )

    def perform_destroy(self, instance):
        user = self.request.user
        if _has_any_role(user, ['owner', 'admin']):
            instance.delete()
            return
        if 'instructor' in get_user_roles(user) and instance.uploaded_by_id == user.id:
            if instance.status not in ('draft', 'review'):
                raise PermissionDenied('Only draft or review content can be deleted.')
            instance.delete()
            return
        raise PermissionDenied('You do not have permission to delete this content.')

    # ─── LIFECYCLE ACTIONS ───────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='submit-for-review')
    def submit_for_review(self, request, pk=None):
        """Instructor submits content for admin/owner review."""
        content = self.get_object()
        user = request.user

        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Not authorized.')
        if _has_role(user, 'instructor') and content.uploaded_by_id != user.id:
            raise PermissionDenied('You can only submit your own content for review.')
        if content.status != 'draft':
            return Response(
                {'detail': f'Cannot submit for review from status "{content.status}". Must be draft.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get('notes', '')
        from_status = content.status
        content.status = 'review'
        content.submitted_for_review_at = timezone.now()
        content.review_notes = notes
        content.save(update_fields=['status', 'submitted_for_review_at', 'review_notes', 'updated_at'])

        ContentStatusLog.objects.create(
            content_item=content,
            action='submitted_for_review',
            from_status=from_status,
            to_status='review',
            notes=notes,
            performed_by=user,
        )

        return Response(ContentItemSerializer(content).data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Admin/Owner approves content and publishes it."""
        content = self.get_object()
        user = request.user

        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins or owners can approve content.')
        if content.status != 'review':
            return Response(
                {'detail': f'Cannot approve from status "{content.status}". Must be under review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get('notes', '')
        from_status = content.status
        content.status = 'published'
        content.published_at = timezone.now()
        content.reviewed_by = user
        content.review_notes = notes
        content.version += 1
        content.save(update_fields=[
            'status', 'published_at', 'reviewed_by', 'review_notes', 'version', 'updated_at',
        ])

        ContentStatusLog.objects.create(
            content_item=content,
            action='published',
            from_status=from_status,
            to_status='published',
            notes=notes,
            performed_by=user,
        )

        return Response(ContentItemSerializer(content).data)

    @action(detail=True, methods=['post'], url_path='return-for-revision')
    def return_for_revision(self, request, pk=None):
        """Admin/Owner returns content to instructor for revision."""
        content = self.get_object()
        user = request.user

        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins or owners can return content for revision.')
        if content.status != 'review':
            return Response(
                {'detail': f'Cannot return from status "{content.status}". Must be under review.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get('notes', '')
        from_status = content.status
        content.status = 'draft'
        content.reviewed_by = user
        content.review_notes = notes
        content.submitted_for_review_at = None
        content.save(update_fields=[
            'status', 'reviewed_by', 'review_notes', 'submitted_for_review_at', 'updated_at',
        ])

        ContentStatusLog.objects.create(
            content_item=content,
            action='returned',
            from_status=from_status,
            to_status='draft',
            notes=notes,
            performed_by=user,
        )

        return Response(ContentItemSerializer(content).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        """Admin/Owner archives content (removes from active use)."""
        content = self.get_object()
        user = request.user

        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins or owners can archive content.')
        if content.status == 'archived':
            return Response(
                {'detail': 'Content is already archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get('notes', '')
        from_status = content.status
        content.status = 'archived'
        content.archived_at = timezone.now()
        content.review_notes = notes
        content.save(update_fields=['status', 'archived_at', 'review_notes', 'updated_at'])

        ContentStatusLog.objects.create(
            content_item=content,
            action='archived',
            from_status=from_status,
            to_status='archived',
            notes=notes,
            performed_by=user,
        )

        return Response(ContentItemSerializer(content).data)

    @action(detail=True, methods=['post'], url_path='revert-to-draft')
    def revert_to_draft(self, request, pk=None):
        """Admin/Owner reverts archived content back to draft."""
        content = self.get_object()
        user = request.user

        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins or owners can revert content.')
        if content.status != 'archived':
            return Response(
                {'detail': f'Cannot revert from status "{content.status}". Must be archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get('notes', '')
        from_status = content.status
        content.status = 'draft'
        content.archived_at = None
        content.review_notes = notes
        content.version += 1
        content.save(update_fields=['status', 'archived_at', 'review_notes', 'version', 'updated_at'])

        ContentStatusLog.objects.create(
            content_item=content,
            action='reverted',
            from_status=from_status,
            to_status='draft',
            notes=notes,
            performed_by=user,
        )

        return Response(ContentItemSerializer(content).data)

"""
Canvas document management with 4-layer RBAC.

Layer permissions:
  question_data:    Instructor (before publish) → read-only for student after
  student_answer_data: Student owns it (locked after submission)
  teacher_feedback_data: Instructor who owns the course
  student_revision_data: Student (only if revision is returned)

Roles:
  Owner/Admin:    full access to all layers
  Instructor:     question + teacher feedback layers; read student data
  Student:        student answer + revision layers; read question + feedback
  Parent:         read-only for linked child's canvas
  Sponsor:        no access (safeguarding boundary)
  Treasurer:      no access
"""

from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from core.audit_mixin import AuditLogMixin
from canvas.models import CanvasDocument, CanvasVersion
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation
)


class CanvasDocumentSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    version_count = serializers.SerializerMethodField()

    class Meta:
        model = CanvasDocument
        fields = [
            'id', 'student', 'student_email', 'course', 'essay_response',
            'schema_version', 'question_data', 'student_answer_data',
            'teacher_feedback_data', 'student_revision_data',
            'page_width', 'page_height', 'status', 'is_locked',
            'submitted_version', 'document_version', 'checksum',
            'version_count', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'student', 'document_version', 'checksum',
            'submitted_version', 'created_at', 'updated_at',
        ]

    def get_version_count(self, obj):
        return obj.versions.count() if hasattr(obj, 'versions') else 0


class CanvasVersionSerializer(serializers.ModelSerializer):
    author_email = serializers.CharField(source='author.email', read_only=True)

    class Meta:
        model = CanvasVersion
        fields = [
            'id', 'version_number', 'author', 'author_email',
            'question_data', 'student_answer_data',
            'teacher_feedback_data', 'student_revision_data',
            'description', 'checksum', 'created_at',
        ]
        read_only_fields = fields


class CanvasDocumentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    Canvas document management with 4-layer RBAC filtering.
    """
    audit_resource_type = 'canvas_document'
    serializer_class = CanvasDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)

        qs = CanvasDocument.objects.select_related('student', 'course', 'essay_response')

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        if 'instructor' in roles:
            # Instructors see canvas docs for their courses
            from courses.models import Course
            course_ids = Course.objects.filter(instructor=user).values_list('id', flat=True)
            return qs.filter(course_id__in=course_ids)

        if 'student' in roles:
            return qs.filter(student=user)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(student_id__in=child_ids)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor', 'student']):
            raise PermissionDenied('You cannot create canvas documents.')
        serializer.save(student=user)

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        roles = get_user_roles(user)

        # Owner/Admin can edit anything
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return

        # Instructor: question + teacher feedback only
        if 'instructor' in roles:
            if instance.course and instance.course.instructor_id == user.id:
                # Instructor can modify question_data and teacher_feedback_data
                allowed_fields = {'question_data', 'teacher_feedback_data'}
                for field in set(serializer.validated_data.keys()) - allowed_fields:
                    raise PermissionDenied(
                        f'Instructors can only modify question and feedback layers, not {field}.'
                    )
                serializer.save()
                return
            raise PermissionDenied('You can only edit canvas for your own courses.')

        # Student: answer + revision only, locked after submission
        if 'student' in roles:
            if instance.student_id != user.id:
                raise PermissionDenied('You can only edit your own canvas.')
            if instance.is_locked or instance.status in ('submitted', 'finalised'):
                raise PermissionDenied('Canvas is locked after submission.')
            allowed_fields = {'student_answer_data', 'student_revision_data'}
            for field in set(serializer.validated_data.keys()) - allowed_fields:
                raise PermissionDenied(f'Students cannot modify {field}.')
            serializer.save()
            return

        raise PermissionDenied('You do not have permission to modify this canvas.')

    @action(detail=True, methods=['post'], url_path='autosave')
    def autosave(self, request, pk=None):
        """
        Autosave canvas data with version tracking and optimistic concurrency.
        Expects: { layer: 'student'|'teacher'|'revision', data: {...}, expected_version: int }
        """
        doc = self.get_object()
        user = request.user
        roles = get_user_roles(user)
        layer = request.data.get('layer')
        data = request.data.get('data', {})
        expected_version = request.data.get('expected_version', doc.document_version)

        # Optimistic concurrency check
        if expected_version != doc.document_version:
            return Response(
                {'error': 'Conflict: document was modified by another user. Please refresh.',
                 'server_version': doc.document_version, 'client_version': expected_version},
                status=status.HTTP_409_CONFLICT,
            )

        # Layer permission check
        layer_field_map = {
            'student': 'student_answer_data',
            'teacher': 'teacher_feedback_data',
            'revision': 'student_revision_data',
            'question': 'question_data',
        }

        if layer not in layer_field_map:
            return Response({'error': f'Invalid layer: {layer}'}, status=status.HTTP_400_BAD_REQUEST)

        field_name = layer_field_map[layer]

        # Permission checks
        if layer in ('student', 'revision'):
            if 'student' not in roles or doc.student_id != user.id:
                raise PermissionDenied('You can only autosave your own student layers.')
            if doc.is_locked or doc.status in ('submitted', 'finalised'):
                raise PermissionDenied('Canvas is locked.')
        elif layer == 'teacher':
            if not _has_any_role(user, ['instructor', 'owner', 'admin']):
                raise PermissionDenied('Only instructors can save teacher feedback.')
            if 'instructor' in roles and doc.course and doc.course.instructor_id != user.id:
                raise PermissionDenied('You can only edit feedback for your own course.')
        elif layer == 'question':
            if not _has_any_role(user, ['instructor', 'owner', 'admin']):
                raise PermissionDenied('Only instructors can edit question data.')

        # Create version snapshot before update
        version_num = doc.document_version + 1
        CanvasVersion.objects.create(
            document=doc,
            version_number=version_num,
            author=user,
            question_data=doc.question_data,
            student_answer_data=doc.student_answer_data,
            teacher_feedback_data=doc.teacher_feedback_data,
            student_revision_data=doc.student_revision_data,
            description=f'Autosave: {layer} layer updated',
        )

        # Update the layer
        setattr(doc, field_name, data)
        doc.document_version = version_num
        doc.save()

        return Response({
            'version': doc.document_version,
            'checksum': doc.checksum,
            'saved_at': doc.updated_at.isoformat(),
        })

    @action(detail=True, methods=['post'], url_path='submit')
    def submit(self, request, pk=None):
        """Student submits the canvas for grading. Locks the student layers."""
        doc = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if 'student' not in roles or doc.student_id != user.id:
            raise PermissionDenied('Only the owning student can submit.')
        if doc.is_locked or doc.status in ('submitted', 'finalised'):
            raise PermissionDenied('Canvas is already submitted.')

        # Create final version snapshot
        version_num = doc.document_version + 1
        CanvasVersion.objects.create(
            document=doc,
            version_number=version_num,
            author=user,
            question_data=doc.question_data,
            student_answer_data=doc.student_answer_data,
            teacher_feedback_data=doc.teacher_feedback_data,
            student_revision_data=doc.student_revision_data,
            description='Final submission',
        )

        doc.status = 'submitted'
        doc.submitted_version = version_num
        doc.is_locked = True
        doc.document_version = version_num
        doc.save()

        return Response({
            'status': 'submitted',
            'version': doc.document_version,
            'submitted_version': doc.submitted_version,
        })

    @action(detail=True, methods=['post'], url_path='return-for-revision')
    def return_for_revision(self, request, pk=None):
        """Instructor returns the canvas for student revision."""
        doc = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if not _has_any_role(user, ['instructor', 'owner', 'admin']):
            raise PermissionDenied('Only instructors can return for revision.')
        if 'instructor' in roles and doc.course and doc.course.instructor_id != user.id:
            raise PermissionDenied('You can only return canvas for your own courses.')
        if doc.status not in ('submitted', 'under_review'):
            raise PermissionDenied('Canvas must be submitted before it can be returned.')

        reason = request.data.get('reason', '')

        version_num = doc.document_version + 1
        CanvasVersion.objects.create(
            document=doc,
            version_number=version_num,
            author=user,
            question_data=doc.question_data,
            student_answer_data=doc.student_answer_data,
            teacher_feedback_data=doc.teacher_feedback_data,
            student_revision_data=doc.student_revision_data,
            description=f'Returned for revision: {reason}' if reason else 'Returned for revision',
        )

        doc.status = 'returned'
        doc.is_locked = False
        doc.document_version = version_num
        doc.save()

        return Response({
            'status': 'returned',
            'version': doc.document_version,
        })

    @action(detail=True, methods=['get'], url_path='versions')
    def version_history(self, request, pk=None):
        """Get the version history for a canvas document."""
        doc = self.get_object()
        versions = doc.versions.all()
        serializer = CanvasVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='versions/(?P<version_num>[0-9]+)')
    def get_version(self, request, pk=None, version_num=None):
        """Get a specific version of a canvas document."""
        doc = self.get_object()
        try:
            version = doc.versions.get(version_number=int(version_num))
        except CanvasVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CanvasVersionSerializer(version)
        return Response(serializer.data)

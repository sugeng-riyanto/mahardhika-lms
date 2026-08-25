"""
Essay assessment views with RBAC filtering.

- Owner/Admin: all essays and responses in their org
- Instructor: essays in their courses, manage responses for grading
- Student: essays in enrolled courses, manage their own responses
- Parent: read-only on their child's responses
"""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django.db.models import Q, Count, Avg

from core.audit_mixin import AuditLogMixin
from essays.models import (
    EssayQuestion, EssayResponse, RubricCriterion,
    RubricLevel, RubricScore, InlineFeedback,
)
from essays.serializers import (
    EssayQuestionSerializer, EssayResponseSerializer,
    RubricCriterionSerializer, RubricCriterionWriteSerializer,
    RubricScoreSerializer, InlineFeedbackSerializer,
    RubricLevelSerializer,
)
from courses.models import Enrolment
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsEssayRole,
)


# ─── Helper ──────────────────────────────────────────────────────────────

def _get_org_queryset(user, base_qs, relation_prefix=''):
    """Filter queryset by user's organisation membership."""
    roles = get_user_roles(user)
    org = get_user_organisation(user)

    if _has_any_role(user, ['owner', 'admin']):
        if org and relation_prefix:
            return base_qs.filter(**{f'{relation_prefix}course__organisation': org})
        elif org:
            return base_qs.filter(organisation=org) if hasattr(base_qs.model, 'organisation') else base_qs
        return base_qs

    if 'instructor' in roles:
        return base_qs.filter(created_by=user)

    if 'student' in roles:
        enrolled_course_ids = Enrolment.objects.filter(
            student=user, status='active'
        ).values_list('course_id', flat=True)
        return base_qs.filter(course_id__in=enrolled_course_ids)

    if 'parent' in roles:
        from identity.models import ParentChildLink
        child_ids = ParentChildLink.objects.filter(
            parent_user=user, is_verified=True, is_active=True, consent_given=True,
        ).values_list('student_user_id', flat=True)
        enrolled_course_ids = Enrolment.objects.filter(
            student_id__in=child_ids, status='active'
        ).values_list('course_id', flat=True)
        return base_qs.filter(course_id__in=enrolled_course_ids)

    return base_qs.none()


# ─── Essay Question ──────────────────────────────────────────────────────

class EssayQuestionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Essay question management with RBAC filtering."""
    audit_resource_type = 'essay_question'
    serializer_class = EssayQuestionSerializer
    permission_classes = [IsAuthenticated, IsEssayRole]

    def get_queryset(self):
        user = self.request.user
        qs = EssayQuestion.objects.select_related('created_by', 'course')
        return _get_org_queryset(user, qs)

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can create essays.')
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return
        if 'instructor' in get_user_roles(user) and instance.created_by_id == user.id:
            serializer.save()
            return
        raise PermissionDenied('You do not have permission to edit this essay.')

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete essays.')
        instance.delete()


# ─── Essay Response ──────────────────────────────────────────────────────

class EssayResponseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Student essay response management with RBAC."""
    audit_resource_type = 'essay_response'
    serializer_class = EssayResponseSerializer
    permission_classes = [IsAuthenticated, IsEssayRole]
    filterset_fields = ['question', 'student', 'status']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = EssayResponse.objects.select_related(
            'question', 'student', 'marked_by',
        ).prefetch_related('rubric_scores', 'inline_feedbacks')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(question__course__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(question__course__instructor=user)

        if 'student' in roles:
            return qs.filter(student=user)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(
                student_id__in=child_ids,
            ).filter(
                Q(status='finalised') | Q(feedback_released=True),
            )

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if 'student' in roles:
            response = serializer.save(
                student=user,
                status='draft',
                version=1,
            )
        elif _has_any_role(user, ['owner', 'admin', 'instructor']):
            response = serializer.save()
        else:
            raise PermissionDenied('You cannot create essay responses.')

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        roles = get_user_roles(user)

        # Students can only update their own draft responses
        if 'student' in roles:
            if instance.student_id != user.id:
                raise PermissionDenied('You can only edit your own response.')
            if instance.status not in ('draft', 'returned'):
                raise PermissionDenied('Response is locked after submission.')
            serializer.save()
            return

        # Instructors can update responses for their course's questions
        if 'instructor' in roles:
            if instance.question.course and instance.question.course.instructor_id == user.id:
                serializer.save(marked_by=user)
                return
            raise PermissionDenied('You can only grade responses in your own courses.')

        # Admin/Owner can update any response
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return

        raise PermissionDenied('You do not have permission to modify this response.')

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_response(self, request, pk=None):
        """Student submits their essay response."""
        response = self.get_object()
        user = request.user

        if response.student_id != user.id:
            return DRFResponse(
                {'detail': 'You can only submit your own response.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if response.status not in ('draft', 'returned'):
            return DRFResponse(
                {'detail': f'Cannot submit response in {response.status} status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check late submission
        question = response.question
        is_late = False
        if question.max_time_minutes and response.created_at:
            deadline = response.created_at + timezone.timedelta(minutes=question.max_time_minutes)
            if timezone.now() > deadline and not question.late_submission_allowed:
                return DRFResponse(
                    {'detail': 'Late submission is not allowed for this essay.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            is_late = timezone.now() > deadline

        # Get or create new version
        if response.status == 'returned':
            version = EssayResponse.objects.filter(
                question=response.question, student=user,
            ).order_by('-version').first()
            next_version = (version.version if version else 0) + 1
            response.version = next_version

        response.status = 'submitted'
        response.submitted_at = timezone.now()
        response.is_late = is_late
        response.save(update_fields=[
            'status', 'submitted_at', 'is_late', 'version', 'updated_at',
        ])

        return DRFResponse(EssayResponseSerializer(response).data)

    @action(detail=True, methods=['post'], url_path='start-grading')
    def start_grading(self, request, pk=None):
        """Instructor marks response as being graded."""
        response = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in roles and response.question.course and
                 response.question.course.instructor_id == user.id)):
            return DRFResponse(
                {'detail': 'You do not have permission to grade this response.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if response.status != 'submitted':
            return DRFResponse(
                {'detail': f'Cannot start grading response in {response.status} status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response.status = 'grading'
        response.marked_by = user
        response.save(update_fields=['status', 'marked_by', 'updated_at'])

        return DRFResponse(EssayResponseSerializer(response).data)

    @action(detail=True, methods=['post'], url_path='release-grade')
    def release_grade(self, request, pk=None):
        """Instructor releases the graded response to the student."""
        response = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in roles and response.question.course and
                 response.question.course.instructor_id == user.id)):
            return DRFResponse(
                {'detail': 'You do not have permission to release this grade.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if response.status not in ('grading', 'submitted'):
            return DRFResponse(
                {'detail': f'Cannot release grade for response in {response.status} status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Compute total from rubric scores
        rubric_scores = response.rubric_scores.all()
        if rubric_scores.exists():
            total = sum(float(s.score) for s in rubric_scores)
            max_total = sum(float(s.criterion.max_score) for s in rubric_scores)
            response.total_score = total
            response.percentage = round((total / max_total * 100), 2) if max_total > 0 else 0
            response.letter_grade = response.compute_letter_grade()

        response.status = 'finalised'
        response.feedback_released = True
        response.feedback_released_at = timezone.now()
        response.save(update_fields=[
            'status', 'total_score', 'percentage', 'letter_grade',
            'feedback_released', 'feedback_released_at', 'updated_at',
        ])

        return DRFResponse(EssayResponseSerializer(response).data)

    @action(detail=True, methods=['post'], url_path='return-for-revision')
    def return_for_revision(self, request, pk=None):
        """Instructor returns the response for student revision."""
        response = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in roles and response.question.course and
                 response.question.course.instructor_id == user.id)):
            return DRFResponse(
                {'detail': 'You do not have permission to return this response.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if response.status not in ('grading', 'submitted'):
            return DRFResponse(
                {'detail': f'Cannot return response in {response.status} status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '')
        overall_feedback = request.data.get('overall_feedback', '')

        response.status = 'returned'
        response.returned_at = timezone.now()
        response.return_reason = reason
        if overall_feedback:
            response.overall_feedback = overall_feedback
        response.save(update_fields=[
            'status', 'returned_at', 'return_reason', 'overall_feedback', 'updated_at',
        ])

        return DRFResponse(EssayResponseSerializer(response).data)


# ─── Rubric Criterion ────────────────────────────────────────────────────

class RubricCriterionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Rubric criterion management."""
    audit_resource_type = 'rubric_criterion'
    serializer_class = RubricCriterionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['question']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return RubricCriterionWriteSerializer
        return RubricCriterionSerializer

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = RubricCriterion.objects.select_related('question')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(question__course__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(question__created_by=user)

        if 'student' in roles:
            enrolled_course_ids = Enrolment.objects.filter(
                student=user, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(question__course_id__in=enrolled_course_ids)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can create rubric criteria.')
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return
        if 'instructor' in get_user_roles(user):
            serializer.save()
            return
        raise PermissionDenied('You do not have permission to edit rubric criteria.')


# ─── Rubric Score ────────────────────────────────────────────────────────

class RubricScoreViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Rubric scoring by instructors."""
    audit_resource_type = 'rubric_score'
    serializer_class = RubricScoreSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['response', 'criterion']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = RubricScore.objects.select_related('response', 'criterion', 'scored_by')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(response__question__course__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(response__question__course__instructor=user)

        if 'student' in roles:
            return qs.filter(response__student=user)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(
                response__student_id__in=child_ids,
                response__feedback_released=True,
            )

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in roles)):
            raise PermissionDenied('Only instructors, admins, or owners can score rubric criteria.')

        serializer.save(scored_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return

        if 'instructor' in roles:
            serializer.save(scored_by=user)
            return

        raise PermissionDenied('You do not have permission to modify rubric scores.')


# ─── Inline Feedback ─────────────────────────────────────────────────────

class InlineFeedbackViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Inline teacher feedback on essay responses."""
    audit_resource_type = 'inline_feedback'
    serializer_class = InlineFeedbackSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['response', 'anchor_type']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = InlineFeedback.objects.select_related('response', 'created_by')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(response__question__course__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(response__question__course__instructor=user)

        if 'student' in roles:
            return qs.filter(
                response__student=user,
                is_visible_to_student=True,
            )

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(
                response__student_id__in=child_ids,
                response__feedback_released=True,
                is_visible_to_student=True,
            )

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in roles)):
            raise PermissionDenied('Only instructors, admins, or owners can create inline feedback.')

        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return

        if 'instructor' in roles:
            serializer.save()
            return

        raise PermissionDenied('You do not have permission to modify inline feedback.')

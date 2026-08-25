"""
Activity management with RBAC filtering and server-side scoring.

- Owner/Admin: all activities in their org
- Instructor: only their created activities
- Student: only published activities in enrolled courses
"""
import hashlib
from rest_framework import viewsets, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from core.audit_mixin import AuditLogMixin
from activities.models import ActivityDefinition, ActivityQuestion, ActivityVersion
from attempts.models import Attempt, Response as AttemptResponse
from courses.models import Enrolment
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsActivityRole,
)


class ActivityQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityQuestion
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActivityDefinitionSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    questions = ActivityQuestionSerializer(many=True, read_only=True)
    total_points = serializers.IntegerField(read_only=True)
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ActivityDefinition
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']


class ActivityDefinitionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Activity definition management with RBAC filtering."""
    audit_resource_type = 'activity_definition'
    serializer_class = ActivityDefinitionSerializer
    permission_classes = [IsAuthenticated, IsActivityRole]
    filterset_fields = ['activity_type', 'status', 'lesson']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)

        qs = ActivityDefinition.objects.select_related('created_by', 'lesson', 'organisation').prefetch_related('questions')

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        if 'instructor' in roles:
            return qs.filter(created_by=user)

        if 'student' in roles:
            enrolled_course_ids = Enrolment.objects.filter(
                student=user, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(
                lesson__course_id__in=enrolled_course_ids,
                status='published',
            )

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            enrolled_course_ids = Enrolment.objects.filter(
                student_id__in=child_ids, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(
                lesson__course_id__in=enrolled_course_ids,
                status='published',
            )

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can create activities.')
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
        raise PermissionDenied('You do not have permission to edit this activity.')

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete activities.')
        instance.delete()

    @action(detail=True, methods=['get'], url_path='questions')
    def get_questions(self, request, pk=None):
        """Get questions for an activity (no answer keys for students)."""
        activity = self.get_object()
        questions = activity.questions.all().order_by('order')
        user = request.user
        roles = get_user_roles(user)

        # Instructors see answer keys
        if _has_any_role(user, ['owner', 'admin', 'instructor']):
            data = ActivityQuestionSerializer(questions, many=True).data
        else:
            # Students don't see correct_answer or explanation
            data = []
            for q in questions:
                q_data = ActivityQuestionSerializer(q).data
                q_data.pop('correct_answer', None)
                q_data.pop('explanation', None)
                data.append(q_data)

        return DRFResponse(data)


class ActivityQuestionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Activity question management with RBAC filtering."""
    audit_resource_type = 'activity_question'
    serializer_class = ActivityQuestionSerializer
    permission_classes = [IsAuthenticated, IsActivityRole]
    filterset_fields = ['activity', 'question_type']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)

        qs = ActivityQuestion.objects.select_related('activity', 'activity__created_by')

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        if 'instructor' in roles:
            return qs.filter(activity__created_by=user)

        # Students: only questions in published activities for enrolled courses
        if 'student' in roles:
            enrolled_course_ids = Enrolment.objects.filter(
                student=user, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(
                activity__lesson__course_id__in=enrolled_course_ids,
                activity__status='published',
            )

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors can create questions.')
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return
        if 'instructor' in get_user_roles(user) and instance.activity.created_by_id == user.id:
            serializer.save()
            return
        raise PermissionDenied('You do not have permission to edit this question.')

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete questions.')
        instance.delete()

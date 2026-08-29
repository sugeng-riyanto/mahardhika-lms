"""
Progress views with RBAC.

- Student: own completion records and course progress
- Instructor: progress of students in their courses
- Parent: progress of linked children
- Admin/Owner: all progress in org
"""
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import api_view, permission_classes as perm, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.audit_mixin import AuditLogMixin
from progress.models import CompletionRecord, CourseProgress
from identity.permissions import (
    _has_role, _has_any_role, get_user_organisation, is_parent_of,
    IsAcademicRole,
)
from courses.models import Course, Enrolment


class CompletionRecordSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True, default=None)

    class Meta:
        model = CompletionRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'completed_at', 'student']


class CourseProgressSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True, default='')
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = CourseProgress
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'completed_lessons',
            'completed_activities', 'overall_percent', 'is_course_completed',
            'completed_at', 'last_activity_at',
        ]


class CompletionRecordViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Completion records — RBAC-scoped."""
    audit_resource_type = 'completion_record'
    serializer_class = CompletionRecordSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return CompletionRecord.objects.none()

        qs = CompletionRecord.objects.filter(course__organisation=org).select_related(
            'student', 'course', 'lesson',
        )

        if _has_role(user, 'student'):
            return qs.filter(student=user)

        if _has_role(user, 'parent'):
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(student_id__in=child_ids)

        if _has_role(user, 'instructor'):
            return qs.filter(course__instructor=user)

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        return CompletionRecord.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if _has_role(user, 'student'):
            # Students can mark their own lessons/activities as complete
            lesson = serializer.validated_data.get('lesson')
            activity = serializer.validated_data.get('activity')
            course = serializer.validated_data.get('course')

            if not course:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Course is required.')

            # Verify enrolment
            if not Enrolment.objects.filter(
                student=user, course=course, status='active',
            ).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You are not enrolled in this course.')

            record = serializer.save(
                student=user,
                is_completed=True,
                completed_at=timezone.now(),
                progress_percent=100,
            )

            # Update course progress
            _update_course_progress(user, course)
        else:
            serializer.save()

    @action(detail=False, methods=['get'])
    def my_progress(self, request):
        """Get current student's course progress summary."""
        user = request.user
        if not _has_role(user, 'student'):
            return Response(
                {'detail': 'Only students can view their progress.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        progress = CourseProgress.objects.filter(student=user).select_related('course')
        return Response(CourseProgressSerializer(progress, many=True).data)


class CourseProgressViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Course progress — RBAC-scoped."""
    audit_resource_type = 'course_progress'
    serializer_class = CourseProgressSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return CourseProgress.objects.none()

        qs = CourseProgress.objects.filter(course__organisation=org).select_related(
            'student', 'course',
        )

        if _has_role(user, 'student'):
            return qs.filter(student=user)

        if _has_role(user, 'parent'):
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(student_id__in=child_ids)

        if _has_role(user, 'instructor'):
            return qs.filter(course__instructor=user)

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        return CourseProgress.objects.none()

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()


def _update_course_progress(student, course):
    """Update or create CourseProgress for a student-course pair."""
    from courses.models import Lesson

    total_lessons = Lesson.objects.filter(course=course, is_published=True).count()
    total_activities = 0  # Would count activities linked to course lessons

    progress, created = CourseProgress.objects.get_or_create(
        student=student, course=course,
        defaults={
            'total_lessons': total_lessons,
            'total_activities': total_activities,
        },
    )
    if not created:
        progress.total_lessons = total_lessons
        progress.total_activities = total_activities

    progress.recalculate()

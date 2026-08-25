"""
Lesson management with RBAC filtering.

- Owner/Admin: all lessons in their org
- Instructor: only lessons in courses they teach
- Student: only published lessons in enrolled courses
- Parent: only published lessons in their child's enrolled courses
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from courses.models import Lesson, Course, Enrolment
from courses.serializers import LessonSerializer
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsAcademicRole,
)


class LessonViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Lesson management with RBAC filtering."""
    audit_resource_type = 'lesson'
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]
    filterset_fields = ['course', 'content_type', 'is_published']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = Lesson.objects.select_related('course', 'course__instructor', 'course__programme')

        # Owner/Admin: all lessons in org courses
        if _has_any_role(user, ['owner', 'admin']):
            if org:
                qs = qs.filter(course__organisation=org)
            return qs

        # Instructor: lessons in their own courses
        if 'instructor' in roles:
            return qs.filter(course__instructor=user)

        # Student: published lessons in enrolled courses
        if 'student' in roles:
            enrolled_course_ids = Enrolment.objects.filter(
                student=user,
                status='active',
            ).values_list('course_id', flat=True)
            return qs.filter(course_id__in=enrolled_course_ids, is_published=True)

        # Parent: published lessons in child's enrolled courses
        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user,
                is_verified=True,
                is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            enrolled_course_ids = Enrolment.objects.filter(
                student_id__in=child_ids,
                status='active',
            ).values_list('course_id', flat=True)
            return qs.filter(course_id__in=enrolled_course_ids, is_published=True)

        # Default: no access
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        course = serializer.validated_data.get('course')

        if not _has_any_role(user, ['owner', 'admin']):
            if not course or course.instructor_id != user.id:
                raise PermissionDenied(
                    'Only the assigned instructor, admin, or owner can create lessons.'
                )
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance

        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return

        if 'instructor' in get_user_roles(user) and instance.course.instructor_id == user.id:
            # Instructors can only update certain fields
            forbidden_fields = {'course', 'order'}
            for field in set(serializer.validated_data.keys()) & forbidden_fields:
                raise PermissionDenied(f'Instructors cannot modify lesson {field}.')
            serializer.save()
            return

        raise PermissionDenied('You do not have permission to edit this lesson.')

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete lessons.')
        instance.is_published = False
        instance.save(update_fields=['is_published', 'updated_at'])

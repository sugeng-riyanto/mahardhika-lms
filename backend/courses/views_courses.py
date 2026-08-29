"""
Course management with RBAC queryset filtering.

- Owner/Admin: all courses in their org
- Instructor: only courses they are assigned to
- Student: only courses they are enrolled in
- Parent: only courses their child is enrolled in
- Other: no access
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from courses.models import Course, Enrolment
from courses.serializers import CourseSerializer
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsAcademicReadOrSponsorRole,
)


class CourseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Course management with RBAC filtering."""
    audit_resource_type = 'course'
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsAcademicReadOrSponsorRole]
    search_fields = ['title', 'slug']
    filterset_fields = ['programme', 'is_published', 'instructor']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = Course.objects.select_related('programme', 'instructor')

        # Owner/Admin: all courses in their org
        if _has_any_role(user, ['owner', 'admin']):
            if org:
                qs = qs.filter(organisation=org)
            return qs

        # Instructor: only courses they teach
        if 'instructor' in roles:
            return qs.filter(instructor=user)

        # Student: only enrolled courses
        if 'student' in roles:
            enrolled_course_ids = Enrolment.objects.filter(
                student=user,
                status='active',
            ).values_list('course_id', flat=True)
            return qs.filter(id__in=enrolled_course_ids)

        # Parent: courses their verified children are enrolled in
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
            return qs.filter(id__in=enrolled_course_ids)

        # Sponsor: read-only access to published courses in org
        if 'sponsorship' in roles:
            if org:
                return qs.filter(organisation=org, is_published=True)
            return qs.none()

        # Default: no access
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)
        # Auto-generate slug from title
        title = serializer.validated_data.get('title', '')
        slug = title.lower().replace(' ', '-').replace('&', 'and')[:50]
        serializer.save(organisation=org, slug=slug, instructor=user if 'instructor' in roles else serializer.validated_data.get('instructor'))

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        roles = get_user_roles(user)

        # Owner/Admin can edit anything in their org
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return

        # Instructor can edit their own courses
        if 'instructor' in roles and instance.instructor_id == user.id:
            allowed_fields = {'description', 'thumbnail_url', 'title', 'is_published'}
            for field in set(serializer.validated_data.keys()) - allowed_fields:
                if field in ('title', 'slug', 'programme', 'organisation'):
                    raise PermissionDenied(
                        f'Instructors cannot modify course {field}.'
                    )
            serializer.save()
            return

        raise PermissionDenied('You do not have permission to edit this course.')

    def perform_destroy(self, instance):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete courses.')
        # Soft delete: unpublish instead of hard delete
        instance.is_published = False
        instance.save(update_fields=['is_published', 'updated_at'])

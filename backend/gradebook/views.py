"""
Grade management with RBAC filtering.

- Owner/Admin: all grades in their org
- Instructor: only grades in their courses (via activity -> lesson -> course)
- Student: only their own grades
- Parent: only their child's grades

Actions:
- POST /grades/{id}/release/ — Release a single grade to student
- POST /grades/bulk-release/ — Release multiple grades at once
- POST /grades/{id}/revoke/ — Un-release a grade (admin only)
"""
from rest_framework import viewsets, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone

from core.audit_mixin import AuditLogMixin
from gradebook.models import Grade, GradeEvent
from courses.models import Enrolment
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsGradeRole,
)


class GradeSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    activity_title = serializers.CharField(source='activity.title', read_only=True)
    activity_type = serializers.CharField(source='activity.activity_type', read_only=True)
    percentage = serializers.SerializerMethodField()
    letter_grade = serializers.SerializerMethodField()

    class Meta:
        model = Grade
        fields = [
            'id', 'student', 'student_email', 'student_name',
            'activity', 'activity_title', 'activity_type',
            'score', 'max_score', 'percentage', 'letter_grade',
            'released', 'released_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'released', 'released_at', 'created_at', 'updated_at']

    def get_percentage(self, obj):
        if obj.max_score and float(obj.max_score) > 0:
            return round(float(obj.score) / float(obj.max_score) * 100, 1)
        return 0

    def get_letter_grade(self, obj):
        pct = self.get_percentage(obj)
        if pct >= 90:
            return 'A+'
        elif pct >= 85:
            return 'A'
        elif pct >= 80:
            return 'A-'
        elif pct >= 75:
            return 'B+'
        elif pct >= 70:
            return 'B'
        elif pct >= 65:
            return 'B-'
        elif pct >= 60:
            return 'C+'
        elif pct >= 55:
            return 'C'
        elif pct >= 50:
            return 'C-'
        elif pct >= 40:
            return 'D'
        return 'F'


class GradeEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True, default=None)

    class Meta:
        model = GradeEvent
        fields = [
            'id', 'grade', 'previous_score', 'new_score',
            'reason', 'actor', 'actor_email',
            'created_at', 'updated_at',
        ]


class GradeViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Grade management with RBAC filtering and release workflow."""
    audit_resource_type = 'grade'
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated, IsGradeRole]
    filterset_fields = ['student', 'activity', 'released']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = Grade.objects.select_related('student', 'activity')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(activity__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(activity__organisation=org) if org else qs.none()

        if 'student' in roles:
            return qs.filter(student=user, released=True)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(student_id__in=child_ids, released=True)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can create grades.')

        if 'instructor' in roles and not _has_any_role(user, ['owner', 'admin']):
            activity = serializer.validated_data.get('activity')
            if activity and activity.lesson and activity.lesson.course.instructor_id != user.id:
                raise PermissionDenied('You can only grade activities in your own courses.')

        grade = serializer.save()

        # Create grade event
        GradeEvent.objects.create(
            grade=grade,
            previous_score=None,
            new_score=grade.score,
            reason='Grade created',
            actor=user,
        )

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        old_score = instance.score

        if _has_any_role(user, ['owner', 'admin']):
            grade = serializer.save()
        elif 'instructor' in get_user_roles(user):
            org = get_user_organisation(user)
            if instance.activity and org and instance.activity.organisation_id == org.id:
                grade = serializer.save()
            else:
                raise PermissionDenied('You do not have permission to modify this grade.')
        else:
            raise PermissionDenied('You do not have permission to modify this grade.')

        # Create grade event if score changed
        if grade.score != old_score:
            GradeEvent.objects.create(
                grade=grade,
                previous_score=old_score,
                new_score=grade.score,
                reason=request_data_reason(self.request.data),
                actor=user,
            )

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete grades.')
        instance.delete()

    @action(detail=True, methods=['post'], url_path='release')
    def release_grade(self, request, pk=None):
        """Release a single grade to the student."""
        grade = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in roles and grade.activity and
                 grade.activity.lesson and grade.activity.lesson.course.instructor_id == user.id)):
            return DRFResponse(
                {'detail': 'You do not have permission to release this grade.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if grade.released:
            return DRFResponse(
                {'detail': 'Grade is already released.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        grade.released = True
        grade.released_at = timezone.now()
        grade.save(update_fields=['released', 'released_at', 'updated_at'])

        GradeEvent.objects.create(
            grade=grade,
            previous_score=grade.score,
            new_score=grade.score,
            reason='Grade released to student',
            actor=user,
        )

        return DRFResponse(GradeSerializer(grade).data)

    @action(detail=False, methods=['post'], url_path='bulk-release')
    def bulk_release(self, request):
        """Release multiple grades at once by activity."""
        user = request.user
        roles = get_user_roles(user)
        activity_id = request.data.get('activity_id')
        grade_ids = request.data.get('grade_ids', [])

        if not activity_id and not grade_ids:
            return DRFResponse(
                {'detail': 'activity_id or grade_ids is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (_has_any_role(user, ['owner', 'admin']) or 'instructor' in roles):
            return DRFResponse(
                {'detail': 'Only instructors, admins, or owners can release grades.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = Grade.objects.filter(released=False)
        if grade_ids:
            qs = qs.filter(id__in=grade_ids)
        elif activity_id:
            qs = qs.filter(activity_id=activity_id)

        # Instructor: only their courses
        if 'instructor' in roles and not _has_any_role(user, ['owner', 'admin']):
            qs = qs.filter(
                activity__lesson__course__instructor=user,
            )

        now = timezone.now()
        released = []
        for grade in qs:
            grade.released = True
            grade.released_at = now
            grade.save(update_fields=['released', 'released_at', 'updated_at'])

            GradeEvent.objects.create(
                grade=grade,
                previous_score=grade.score,
                new_score=grade.score,
                reason='Bulk release',
                actor=user,
            )
            released.append(grade.id)

        return DRFResponse({
            'released_count': len(released),
            'released_ids': [str(rid) for rid in released],
        })

    @action(detail=True, methods=['post'], url_path='revoke')
    def revoke_grade(self, request, pk=None):
        """Un-release a grade (admin/owner only)."""
        grade = self.get_object()
        user = request.user

        if not _has_any_role(user, ['owner', 'admin']):
            return DRFResponse(
                {'detail': 'Only admins or owners can revoke released grades.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not grade.released:
            return DRFResponse(
                {'detail': 'Grade is not released.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', 'Grade revoked by admin')
        grade.released = False
        grade.released_at = None
        grade.save(update_fields=['released', 'released_at', 'updated_at'])

        GradeEvent.objects.create(
            grade=grade,
            previous_score=grade.score,
            new_score=grade.score,
            reason=reason,
            actor=user,
        )

        return DRFResponse(GradeSerializer(grade).data)


class GradeEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Grade event history -- read-only."""
    serializer_class = GradeEventSerializer
    permission_classes = [IsAuthenticated, IsGradeRole]

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = GradeEvent.objects.select_related('grade', 'grade__student', 'grade__activity', 'actor')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(grade__activity__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(grade__activity__organisation=org) if org else qs.none()

        if 'student' in roles:
            return qs.filter(grade__student=user)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(grade__student_id__in=child_ids)

        return qs.none()


def request_data_reason(data):
    """Extract reason from request data, default to empty."""
    return data.get('reason', '') if isinstance(data, dict) else ''

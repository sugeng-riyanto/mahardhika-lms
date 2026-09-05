"""
Attendance views with RBAC filtering.

- Owner/Admin: all schedules and attendance in their org
- Instructor: schedules and attendance for their courses
- Student: schedules for enrolled courses, own attendance records
- Parent: their child's attendance records
"""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone

from core.audit_mixin import AuditLogMixin
from attendance.models import LessonSchedule, AttendanceRecord
from attendance.serializers import (
    LessonScheduleSerializer, AttendanceRecordSerializer,
    SelfCheckInSerializer,
)
from courses.models import Enrolment
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsAcademicRole,
)


# ─── Schedule ViewSet ────────────────────────────────────────────────────

class LessonScheduleViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Lesson schedule management with RBAC."""
    audit_resource_type = 'lesson_schedule'
    serializer_class = LessonScheduleSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]
    filterset_fields = ['course', 'lesson', 'date', 'is_cancelled']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = LessonSchedule.objects.select_related('lesson', 'course')

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(course__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(course__instructor=user)

        if 'student' in roles:
            enrolled_course_ids = Enrolment.objects.filter(
                student=user, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(course_id__in=enrolled_course_ids)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            enrolled_course_ids = Enrolment.objects.filter(
                student_id__in=child_ids, status='active'
            ).values_list('course_id', flat=True)
            return qs.filter(course_id__in=enrolled_course_ids)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can create schedules.')
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save()
            return
        if 'instructor' in get_user_roles(user):
            if instance.course.instructor_id == user.id:
                serializer.save()
                return
        raise PermissionDenied('You do not have permission to modify this schedule.')

    def perform_destroy(self, instance):
        if not _has_any_role(self.request.user, ['owner', 'admin']):
            raise PermissionDenied('Only owners and admins can delete schedules.')
        instance.delete()

    @action(detail=True, methods=['get'], url_path='roster')
    def roster(self, request, pk=None):
        """Active students enrolled in this schedule's course, with current statuses."""
        user = request.user
        schedule = self.get_object()

        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in get_user_roles(user) and
                 schedule.course.instructor_id == user.id)):
            raise PermissionDenied('You do not have permission to take roll for this schedule.')

        records = {r.student_id: r for r in AttendanceRecord.objects.filter(schedule=schedule)}
        students = Enrolment.objects.filter(
            course=schedule.course, status='active',
        ).select_related('student').order_by('student__full_name')

        return DRFResponse({
            'schedule_id': str(schedule.id),
            'lesson_title': schedule.lesson.title,
            'course_title': schedule.course.title,
            'date': schedule.date,
            'students': [
                {
                    'student': str(enrol.student_id),
                    'student_email': enrol.student.email,
                    'student_name': enrol.student.full_name,
                    'status': records[enrol.student_id].status if enrol.student_id in records else None,
                    'notes': records[enrol.student_id].notes if enrol.student_id in records else '',
                }
                for enrol in students
            ],
        })


# ─── Attendance Record ViewSet ───────────────────────────────────────────

class AttendanceRecordViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Attendance record management with RBAC."""
    audit_resource_type = 'attendance_record'
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]
    filterset_fields = ['schedule', 'student', 'status']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = AttendanceRecord.objects.select_related(
            'schedule', 'schedule__lesson', 'schedule__course',
            'student', 'marked_by',
        )

        if _has_any_role(user, ['owner', 'admin']):
            if org:
                return qs.filter(schedule__course__organisation=org)
            return qs

        if 'instructor' in roles:
            return qs.filter(schedule__course__instructor=user)

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
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            raise PermissionDenied('Only instructors, admins, or owners can create attendance records.')
        serializer.save(marked_by=user, marked_at=timezone.now())

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        if _has_any_role(user, ['owner', 'admin']):
            serializer.save(marked_by=user)
            return
        if 'instructor' in get_user_roles(user):
            if instance.schedule.course.instructor_id == user.id:
                serializer.save(marked_by=user)
                return
        raise PermissionDenied('You do not have permission to modify attendance records.')

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        """Bulk update attendance for a schedule (instructor marks whole class)."""
        user = request.user
        schedule_id = request.data.get('schedule_id')
        records = request.data.get('records', [])

        if not schedule_id or not records:
            return DRFResponse(
                {'detail': 'schedule_id and records are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            schedule = LessonSchedule.objects.get(id=schedule_id)
        except LessonSchedule.DoesNotExist:
            return DRFResponse(
                {'detail': 'Schedule not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Permission check
        if not (_has_any_role(user, ['owner', 'admin']) or
                ('instructor' in get_user_roles(user) and
                 schedule.course.instructor_id == user.id)):
            return DRFResponse(
                {'detail': 'You do not have permission to mark attendance for this schedule.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        created = []
        for record_data in records:
            student_id = record_data.get('student')
            attendance_status = record_data.get('status', 'absent')
            notes = record_data.get('notes', '')

            if not student_id:
                continue

            obj, was_created = AttendanceRecord.objects.update_or_create(
                schedule=schedule,
                student_id=student_id,
                defaults={
                    'status': attendance_status,
                    'notes': notes,
                    'marked_by': user,
                    'marked_at': timezone.now(),
                },
            )
            created.append(AttendanceRecordSerializer(obj).data)

        return DRFResponse({'results': created, 'count': len(created)})

    @action(detail=False, methods=['post'], url_path='self-check-in')
    def self_check_in(self, request):
        """Student self-service check-in with selfie + geolocation."""
        user = request.user
        roles = get_user_roles(user)

        if 'student' not in roles:
            return DRFResponse(
                {'detail': 'Only students can self-check in.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = SelfCheckInSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        schedule_id = ser.validated_data['schedule_id']
        try:
            schedule = LessonSchedule.objects.get(id=schedule_id)
        except LessonSchedule.DoesNotExist:
            return DRFResponse(
                {'detail': 'Schedule not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify student is enrolled in the course
        enrolled = Enrolment.objects.filter(
            student=user, course=schedule.course, status='active',
        ).exists()
        if not enrolled:
            return DRFResponse(
                {'detail': 'You are not enrolled in this course.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only allow check-in on the schedule date
        from django.utils import timezone as tz
        today = tz.localdate()
        if schedule.date != today:
            return DRFResponse(
                {'detail': f'Check-in is only allowed on the scheduled date ({schedule.date}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        face = ser.validated_data.get('face_thumbnail', '')
        lat = ser.validated_data.get('latitude')
        lng = ser.validated_data.get('longitude')
        accuracy = ser.validated_data.get('location_accuracy_m')

        # Determine status: present if on time, late if past start_time
        status_val = 'present'
        if schedule.start_time:
            now_time = tz.localtime().time()
            if now_time > schedule.start_time:
                # More than 15 min late = late
                import datetime
                diff = datetime.datetime.combine(today, now_time) - datetime.datetime.combine(today, schedule.start_time)
                if diff.total_seconds() > 900:  # 15 min
                    status_val = 'late'

        obj, was_created = AttendanceRecord.objects.update_or_create(
            schedule=schedule,
            student=user,
            defaults={
                'status': status_val,
                'face_thumbnail': face,
                'latitude': lat,
                'longitude': lng,
                'location_accuracy_m': accuracy,
                'self_checked': True,
                'marked_by': user,
                'marked_at': tz.now(),
                'notes': f'Self check-in{f" (GPS ±{accuracy:.0f}m)" if accuracy else ""}',
            },
        )

        return DRFResponse({
            'success': True,
            'status': status_val,
            'record_id': str(obj.id),
            'was_created': was_created,
            'message': f'Checked in as {status_val}.',
        })

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Get attendance summary statistics."""
        user = request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = AttendanceRecord.objects.select_related('schedule', 'student')

        # Filter by org
        if _has_any_role(user, ['owner', 'admin']):
            if org:
                qs = qs.filter(schedule__course__organisation=org)
        elif 'instructor' in roles:
            qs = qs.filter(schedule__course__instructor=user)
        elif 'student' in roles:
            qs = qs.filter(student=user)
        elif 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True, consent_given=True,
            ).values_list('student_user_id', flat=True)
            qs = qs.filter(student_id__in=child_ids)

        total = qs.count()
        present = qs.filter(status='present').count()
        late = qs.filter(status='late').count()
        absent = qs.filter(status='absent').count()
        excused = qs.filter(status='excused').count()

        rate = 0
        if total > 0:
            rate = round(((present + late) / total) * 100, 1)

        return DRFResponse({
            'total': total,
            'present': present,
            'late': late,
            'absent': absent,
            'excused': excused,
            'rate': rate,
        })

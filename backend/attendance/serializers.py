from rest_framework import serializers
from attendance.models import LessonSchedule, AttendanceRecord


class LessonScheduleSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    attendance_count = serializers.SerializerMethodField()

    class Meta:
        model = LessonSchedule
        fields = [
            'id', 'lesson', 'lesson_title', 'course', 'course_title',
            'date', 'start_time', 'end_time', 'location',
            'is_cancelled', 'cancellation_reason', 'notes',
            'attendance_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_attendance_count(self, obj):
        records = obj.attendance_records.all()
        total = records.count()
        present = records.filter(status__in=['present', 'late']).count()
        return {'total': total, 'present': present}


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    lesson_title = serializers.CharField(source='schedule.lesson.title', read_only=True)
    schedule_date = serializers.DateField(source='schedule.date', read_only=True)
    course_title = serializers.CharField(source='schedule.course.title', read_only=True)
    marked_by_email = serializers.CharField(source='marked_by.email', read_only=True, default=None)

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'schedule', 'student', 'student_email', 'student_name',
            'status', 'notes', 'marked_by', 'marked_by_email',
            'marked_at',
            'lesson_title', 'schedule_date', 'course_title',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'marked_at', 'created_at', 'updated_at']


class AttendanceBulkSerializer(serializers.Serializer):
    """Bulk attendance update for a schedule."""
    schedule_id = serializers.UUIDField()
    records = serializers.ListField(
        child=serializers.DictField(),
    )

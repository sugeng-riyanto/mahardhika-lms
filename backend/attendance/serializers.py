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
            'face_thumbnail', 'latitude', 'longitude',
            'location_accuracy_m', 'self_checked',
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


class SelfCheckInSerializer(serializers.Serializer):
    """Student self-service check-in with selfie + geolocation."""
    schedule_id = serializers.UUIDField()
    face_thumbnail = serializers.CharField(
        required=False, allow_blank=True, max_length=100_000,
        help_text='Base64 JPEG thumbnail ≤50 KB.',
    )
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True,
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True,
    )
    location_accuracy_m = serializers.FloatField(
        required=False, allow_null=True,
    )

    def validate_face_thumbnail(self, value):
        if not value:
            return value
        raw = value
        if ',' in raw and raw.startswith('data:'):
            raw = raw.split(',', 1)[1]
        raw_bytes = len(raw) * 3 // 4
        if raw_bytes > 50 * 1024:
            raise serializers.ValidationError('Face thumbnail must be under 50 KB.')
        return value

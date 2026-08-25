from rest_framework import serializers
from courses.models import Programme, Course, Lesson, Enrolment


class ProgrammeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programme
        fields = [
            'id', 'organisation', 'name', 'slug', 'description',
            'level', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CourseSerializer(serializers.ModelSerializer):
    instructor_email = serializers.CharField(source='instructor.email', read_only=True, default=None)

    class Meta:
        model = Course
        fields = [
            'id', 'programme', 'organisation', 'title', 'slug',
            'description', 'instructor', 'instructor_email',
            'is_published', 'thumbnail_url', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = [
            'id', 'course', 'title', 'description', 'order',
            'content_type', 'content_data', 'is_published',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EnrolmentSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = Enrolment
        fields = [
            'id', 'student', 'student_email', 'course', 'course_title',
            'status', 'enrolled_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

from rest_framework import serializers
from essays.models import (
    EssayQuestion, EssayResponse, RubricCriterion,
    RubricLevel, RubricScore, InlineFeedback,
)


class RubricLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricLevel
        fields = ['id', 'label', 'description', 'score']
        read_only_fields = ['id']


class RubricCriterionSerializer(serializers.ModelSerializer):
    levels = RubricLevelSerializer(many=True, read_only=True)

    class Meta:
        model = RubricCriterion
        fields = ['id', 'name', 'description', 'max_score', 'order', 'levels']
        read_only_fields = ['id']


class RubricCriterionWriteSerializer(serializers.ModelSerializer):
    """For creating criteria inline with levels."""
    levels = RubricLevelSerializer(many=True, required=False)

    class Meta:
        model = RubricCriterion
        fields = ['id', 'question', 'name', 'description', 'max_score', 'order', 'levels']
        read_only_fields = ['id']

    def create(self, validated_data):
        levels_data = validated_data.pop('levels', [])
        criterion = RubricCriterion.objects.create(**validated_data)
        for level_data in levels_data:
            RubricLevel.objects.create(criterion=criterion, **level_data)
        return criterion

    def update(self, instance, validated_data):
        levels_data = validated_data.pop('levels', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if levels_data is not None:
            instance.levels.all().delete()
            for level_data in levels_data:
                RubricLevel.objects.create(criterion=instance, **level_data)
        return instance


class EssayQuestionSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, default=None)
    rubric_criteria = RubricCriterionSerializer(many=True, read_only=True)
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = EssayQuestion
        fields = [
            'id', 'title', 'description', 'content_data', 'marks',
            'expected_answer', 'learning_objectives', 'difficulty', 'status',
            'max_time_minutes', 'allow_canvas_response', 'allow_typed_response',
            'allow_file_upload', 'late_submission_allowed', 'late_penalty_percent',
            'course', 'course_title', 'lesson', 'created_by', 'created_by_email',
            'rubric_criteria', 'response_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_response_count(self, obj):
        return obj.responses.count() if hasattr(obj, 'responses') else 0


class EssayResponseSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    question_title = serializers.CharField(source='question.title', read_only=True)
    question_marks = serializers.IntegerField(source='question.marks', read_only=True)
    marked_by_email = serializers.CharField(source='marked_by.email', read_only=True, default=None)
    rubric_scores = serializers.SerializerMethodField()
    inline_feedbacks = serializers.SerializerMethodField()
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = EssayResponse
        fields = [
            'id', 'question', 'question_title', 'question_marks',
            'student', 'student_email', 'student_name',
            'typed_answer', 'canvas_data', 'attachments',
            'status', 'submitted_at', 'is_late', 'version',
            'total_score', 'percentage', 'letter_grade',
            'overall_feedback', 'feedback_released', 'feedback_released_at',
            'returned_at', 'return_reason',
            'marked_by', 'marked_by_email',
            'rubric_scores', 'inline_feedbacks',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'student', 'total_score', 'percentage', 'letter_grade',
            'submitted_at', 'is_late', 'version',
            'feedback_released', 'feedback_released_at',
            'returned_at', 'created_at', 'updated_at',
        ]

    def get_rubric_scores(self, obj):
        scores = obj.rubric_scores.select_related('criterion', 'scored_by').all()
        return RubricScoreSerializer(scores, many=True).data

    def get_inline_feedbacks(self, obj):
        feedbacks = obj.inline_feedbacks.select_related('created_by').all()
        return InlineFeedbackSerializer(feedbacks, many=True).data

    def get_percentage(self, obj):
        if obj.total_score and obj.question and obj.question.marks:
            return round(float(obj.total_score) / float(obj.question.marks) * 100, 1)
        return None


class RubricScoreSerializer(serializers.ModelSerializer):
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)
    criterion_max_score = serializers.DecimalField(
        source='criterion.max_score', max_digits=10, decimal_places=2, read_only=True,
    )
    scored_by_email = serializers.CharField(source='scored_by.email', read_only=True, default=None)

    class Meta:
        model = RubricScore
        fields = [
            'id', 'response', 'criterion', 'criterion_name', 'criterion_max_score',
            'score', 'comment', 'scored_by', 'scored_by_email',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_score(self, value):
        criterion = self.initial_data.get('criterion')
        if criterion:
            try:
                crit = RubricCriterion.objects.get(id=criterion)
                if value > crit.max_score:
                    raise serializers.ValidationError(
                        f'Score cannot exceed max score of {crit.max_score}'
                    )
            except RubricCriterion.DoesNotExist:
                pass
        return value


class InlineFeedbackSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, default=None)

    class Meta:
        model = InlineFeedback
        fields = [
            'id', 'response', 'anchor_type',
            'text_start', 'text_end', 'selected_text',
            'canvas_x', 'canvas_y', 'canvas_width', 'canvas_height',
            'comment', 'is_visible_to_student',
            'created_by', 'created_by_email',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

"""
Attempt and Response management with RBAC filtering and server-side scoring.

- Owner/Admin: all attempts in their org
- Instructor: attempts in their courses
- Student: only their own attempts
- Parent: only their child's attempts
"""
from decimal import Decimal
from rest_framework import viewsets, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from core.audit_mixin import AuditLogMixin
from attempts.models import Attempt, Response
from activities.models import ActivityQuestion
from courses.models import Enrolment
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsAcademicRole,
)


class ResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Response
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'score', 'max_score', 'is_correct', 'feedback', 'answered_at']


class AttemptSerializer(serializers.ModelSerializer):
    responses = ResponseSerializer(many=True, read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.SerializerMethodField()
    activity_title = serializers.SerializerMethodField()
    activity_type = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'student', 'score', 'max_score',
            'percentage', 'letter_grade', 'passed', 'submitted_at', 'idempotency_key',
        ]

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else ''

    def get_activity_title(self, obj):
        return obj.activity.title if obj.activity else ''

    def get_activity_type(self, obj):
        return obj.activity.activity_type if obj.activity else ''


class AttemptViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Attempt management with RBAC filtering and server-side scoring."""
    audit_resource_type = 'attempt'
    serializer_class = AttemptSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]
    filterset_fields = ['student', 'activity', 'status']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)

        qs = Attempt.objects.select_related('student', 'activity', 'activity__lesson')

        # Owner/Admin: all attempts in their org
        if _has_any_role(user, ['owner', 'admin']):
            return qs

        # Instructor: attempts in their courses
        if 'instructor' in roles:
            return qs.filter(
                activity__lesson__course__instructor=user,
            )

        # Student: only their own attempts
        if 'student' in roles:
            return qs.filter(student=user)

        # Parent: only their child's attempts
        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user,
                is_verified=True,
                is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(student_id__in=child_ids)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if 'student' not in roles:
            raise PermissionDenied('Only students can create attempts.')

        activity = serializer.validated_data.get('activity')
        if not activity:
            raise PermissionDenied('Activity is required.')

        # Verify student is enrolled
        if activity.lesson_id:
            enrolled = Enrolment.objects.filter(
                student=user,
                course=activity.lesson.course,
                status='active',
            ).exists()
            if not enrolled:
                raise PermissionDenied('You are not enrolled in this course.')

        # Check attempt limit
        existing_count = Attempt.objects.filter(
            student=user, activity=activity,
        ).exclude(status='voided').count()
        if existing_count >= activity.max_attempts:
            raise PermissionDenied(f'Maximum {activity.max_attempts} attempt(s) allowed.')

        serializer.save(
            student=user,
            attempt_number=existing_count + 1,
            max_score=activity.total_points,
        )

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        roles = get_user_roles(user)

        # Student can only update their own draft attempts
        if 'student' in roles:
            if instance.student_id != user.id:
                raise PermissionDenied('You can only update your own attempts.')
            if instance.status == 'submitted':
                raise PermissionDenied('Cannot modify a submitted attempt.')
            forbidden_fields = {'student', 'activity', 'score', 'feedback', 'max_score'}
            for field in set(serializer.validated_data.keys()) & forbidden_fields:
                raise PermissionDenied(f'Students cannot modify {field}.')
            serializer.save()
            return

        # Instructor can update scoring/feedback
        if _has_any_role(user, ['instructor', 'owner', 'admin']):
            serializer.save()
            return

        raise PermissionDenied('You do not have permission to modify this attempt.')

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_attempt(self, request, pk=None):
        """Submit attempt and perform server-side scoring."""
        attempt = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        # Only the student can submit their own attempt
        if 'student' in roles and attempt.student_id != user.id:
            return DRFResponse(
                {'detail': 'You can only submit your own attempts.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if attempt.status not in ('not_started', 'in_progress'):
            return DRFResponse(
                {'detail': f'Cannot submit an attempt with status "{attempt.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Score the responses server-side
        activity = attempt.activity
        if activity:
            questions = activity.questions.all()
            total_score = Decimal('0')
            total_max = Decimal('0')

            responses = attempt.responses.all()
            for response in responses:
                question = response.question
                if not question:
                    continue

                max_pts = Decimal(str(question.points))
                total_max += max_pts
                is_correct = False
                earned = Decimal('0')

                answer = response.answer_data
                correct = question.correct_answer

                if question.question_type == 'multiple_choice':
                    is_correct = str(answer.get('selected', '')).lower() == str(correct).lower()
                elif question.question_type == 'true_false':
                    is_correct = str(answer.get('selected', '')).lower() == str(correct).lower()
                elif question.question_type == 'multiple_select':
                    selected = set(str(s).lower() for s in answer.get('selected', []))
                    correct_set = set(str(c).lower() for c in (correct if isinstance(correct, list) else [correct]))
                    is_correct = selected == correct_set
                elif question.question_type == 'drag_and_drop':
                    is_correct = answer.get('result') == correct
                else:
                    # For ungraded types, leave as-is
                    continue

                earned = max_pts if is_correct else Decimal('0')

                response.is_correct = is_correct
                response.score = earned
                response.max_score = max_pts
                response.save(update_fields=['is_correct', 'score', 'max_score'])

                total_score += earned

            # Update attempt totals
            attempt.score = total_score
            attempt.max_score = total_max if total_max > 0 else attempt.max_score
            attempt.percentage = (
                round(total_score / total_max * 100, 2) if total_max > 0 else None
            )
            attempt.passed = (
                attempt.percentage >= activity.pass_mark_percentage
                if attempt.percentage is not None else None
            )

            # Letter grade
            if attempt.percentage is not None:
                pct = float(attempt.percentage)
                if pct >= 95:
                    attempt.letter_grade = 'A+'
                elif pct >= 90:
                    attempt.letter_grade = 'A'
                elif pct >= 85:
                    attempt.letter_grade = 'A-'
                elif pct >= 80:
                    attempt.letter_grade = 'B+'
                elif pct >= 75:
                    attempt.letter_grade = 'B'
                elif pct >= 70:
                    attempt.letter_grade = 'B-'
                elif pct >= 65:
                    attempt.letter_grade = 'C+'
                elif pct >= 60:
                    attempt.letter_grade = 'C'
                elif pct >= 55:
                    attempt.letter_grade = 'C-'
                elif pct >= 50:
                    attempt.letter_grade = 'D'
                else:
                    attempt.letter_grade = 'F'

        attempt.status = 'submitted'
        attempt.submitted_at = timezone.now()
        attempt.save()

        serializer = self.get_serializer(attempt)
        return DRFResponse(serializer.data)

    @action(detail=True, methods=['get'], url_path='result')
    def get_result(self, request, pk=None):
        """Get the result of a submitted/graded attempt (includes correct answers if enabled)."""
        attempt = self.get_object()

        if attempt.status not in ('submitted', 'graded'):
            return DRFResponse(
                {'detail': 'Result is only available after submission.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        roles = get_user_roles(user)
        show_answers = (
            attempt.activity.show_correct_answers if attempt.activity else True
        )

        responses = attempt.responses.select_related('question').all()
        response_data = []
        for r in responses:
            r_data = ResponseSerializer(r).data
            # Add question prompt for reference
            if r.question:
                r_data['question_prompt'] = r.question.prompt
                r_data['question_type'] = r.question.question_type
                if show_answers or _has_any_role(user, ['owner', 'admin', 'instructor']):
                    r_data['correct_answer'] = r.question.correct_answer
                    r_data['explanation'] = r.question.explanation
            response_data.append(r_data)

        return DRFResponse({
            'attempt': AttemptSerializer(attempt).data,
            'responses': response_data,
        })


    @action(detail=True, methods=['post'], url_path='save-path')
    def save_path(self, request, pk=None):
        """Save branching scenario path history and score."""
        attempt = self.get_object()
        user = request.user
        roles = get_user_roles(user)

        if 'student' in roles and attempt.student_id != user.id:
            return DRFResponse(
                {'detail': 'You can only save paths for your own attempts.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if attempt.status not in ('not_started', 'in_progress'):
            return DRFResponse(
                {'detail': f'Cannot save path for attempt with status "{attempt.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        path_data = request.data.get('path', [])
        score = request.data.get('score', 0)
        max_score = request.data.get('max_score', 0)
        outcome = request.data.get('outcome', '')

        # Update attempt with branching scenario data
        attempt.score = Decimal(str(score))
        attempt.max_score = Decimal(str(max_score)) if max_score else attempt.max_score
        attempt.percentage = (
            round(float(score) / float(max_score) * 100, 2) if max_score > 0 else None
        )
        attempt.passed = (
            attempt.percentage >= attempt.activity.pass_mark_percentage
            if attempt.percentage is not None and attempt.activity else None
        )

        # Letter grade
        if attempt.percentage is not None:
            pct = float(attempt.percentage)
            if pct >= 95: attempt.letter_grade = 'A+'
            elif pct >= 90: attempt.letter_grade = 'A'
            elif pct >= 80: attempt.letter_grade = 'B'
            elif pct >= 70: attempt.letter_grade = 'C'
            elif pct >= 60: attempt.letter_grade = 'D'
            else: attempt.letter_grade = 'F'

        attempt.status = 'submitted'
        attempt.submitted_at = timezone.now()

        # Store path in attempt settings
        attempt.settings = {**attempt.settings, 'branching_path': path_data, 'outcome': outcome}
        attempt.save()

        serializer = self.get_serializer(attempt)
        return DRFResponse(serializer.data)


class ResponseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Response management with RBAC filtering."""
    audit_resource_type = 'response'
    serializer_class = ResponseSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]
    filterset_fields = ['attempt', 'question']

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)

        qs = Response.objects.select_related('attempt', 'attempt__student', 'attempt__activity')

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        if 'instructor' in roles:
            return qs.filter(attempt__activity__lesson__course__instructor=user)

        if 'student' in roles:
            return qs.filter(attempt__student=user)

        if 'parent' in roles:
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user,
                is_verified=True,
                is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(attempt__student_id__in=child_ids)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if 'student' not in roles:
            raise PermissionDenied('Only students can create responses.')

        attempt = serializer.validated_data.get('attempt')
        if attempt and attempt.student_id != user.id:
            raise PermissionDenied('You can only respond to your own attempts.')
        if attempt and attempt.status == 'submitted':
            raise PermissionDenied('Cannot add responses to a submitted attempt.')

        # Auto-set question FK from question_id if not set
        if not serializer.validated_data.get('question') and serializer.validated_data.get('question_id'):
            try:
                q = ActivityQuestion.objects.get(id=serializer.validated_data['question_id'])
                serializer.validated_data['question'] = q
            except (ActivityQuestion.DoesNotExist, ValueError):
                pass

        # Set max_score from question
        question = serializer.validated_data.get('question')
        if question:
            serializer.validated_data['max_score'] = question.points

        super().perform_create(serializer)

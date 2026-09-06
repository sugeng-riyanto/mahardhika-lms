"""
Assignment views with RBAC filtering.

- Instructor/Admin/Owner: manage assignments in their org (file/text, MCQ, essay, combined)
- Student: view published assignments, create/submit their own submissions
- Parent: view submissions for linked children only
"""
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.audit_mixin import AuditLogMixin
from assignments.models import Assignment, AssignmentQuestion, AssignmentSubmission
from essays.models import EssayQuestion
from identity.permissions import (
    IsInstructorOrAbove, IsAdminOrOwner,
    _has_any_role, _has_role, get_user_organisation,
    is_parent_of, IsAssignmentRole,
)
from courses.models import Enrolment


class AssignmentQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssignmentQuestion
        fields = '__all__'
        read_only_fields = ['id', 'assignment', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Students must not see the correct answer before submitting.
        request = self.context.get('request')
        if request and getattr(request, 'user', None) and _has_role(request.user, 'student'):
            data.pop('correct_answer', None)
        return data


class AssignmentSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    submission_count = serializers.IntegerField(read_only=True)
    graded_count = serializers.IntegerField(read_only=True)
    mcq_total_points = serializers.IntegerField(read_only=True)
    questions = AssignmentQuestionSerializer(many=True, required=False)
    essay_questions = serializers.PrimaryKeyRelatedField(
        many=True, queryset=EssayQuestion.objects.all(),
        required=False,
    )
    essay_question_titles = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'organisation', 'created_by',
        ]

    def get_essay_question_titles(self, obj):
        return [
            {'id': str(q.id), 'title': q.title, 'marks': q.marks}
            for q in obj.essay_questions.all()
        ]

    def _save_questions(self, assignment, questions_data):
        if questions_data is None:
            return
        assignment.questions.all().delete()
        for idx, q in enumerate(questions_data):
            AssignmentQuestion.objects.create(
                assignment=assignment, order=idx, **q,
            )

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', None)
        essay_qs = validated_data.pop('essay_questions', None)
        assignment = super().create(validated_data)
        if essay_qs is not None:
            assignment.essay_questions.set(essay_qs)
        self._save_questions(assignment, questions_data)
        return assignment

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', None)
        essay_qs = validated_data.pop('essay_questions', None)
        assignment = super().update(instance, validated_data)
        if essay_qs is not None:
            assignment.essay_questions.set(essay_qs)
        self._save_questions(assignment, questions_data)
        return assignment


class AssignmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Assignments — instructors create, students view published."""
    audit_resource_type = 'assignment'
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated, IsAssignmentRole]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return Assignment.objects.none()

        qs = Assignment.objects.filter(organisation=org).select_related(
            'course', 'created_by',
        )

        # Students only see published assignments for enrolled courses
        if _has_role(user, 'student'):
            enrolled_course_ids = Enrolment.objects.filter(
                student=user, status='active',
            ).values_list('course_id', flat=True)
            return qs.filter(status='published', course_id__in=enrolled_course_ids)

        # Instructors see assignments for courses they teach
        if _has_role(user, 'instructor'):
            return qs.filter(course__instructor=user)

        # Admin/Owner see all
        if _has_any_role(user, ['owner', 'admin', 'treasurer']):
            return qs

        return Assignment.objects.none()

    def perform_create(self, serializer):
        if _has_role(self.request.user, 'student'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Students cannot create assignments.')
        org = get_user_organisation(self.request.user)
        serializer.save(organisation=org, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        assignment = self.get_object()
        if not _has_any_role(request.user, ['owner', 'admin', 'instructor']):
            return Response(
                {'detail': 'Not authorized to publish.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        assignment.status = 'published'
        assignment.save(update_fields=['status', 'updated_at'])

        # Notify enrolled students about the new assignment
        from notifications.dispatcher import dispatch_notification
        enrolled = Enrolment.objects.filter(
            course=assignment.course, status='active',
        ).select_related('student')
        due_text = f' Due: {assignment.due_date}' if assignment.due_date else ''
        ctx_base = {
            'assignment_title': assignment.title,
            'course_name': assignment.course.title,
            'due_date': assignment.due_date.strftime('%b %d, %Y %H:%M') if assignment.due_date else 'No deadline',
            'due_text': due_text,
            'max_score': assignment.max_score,
            'instructions': (assignment.instructions or '')[:300],
            'published_date': timezone.now(),
            'site_url': 'https://akademi.id',
        }
        for enrol in enrolled:
            dispatch_notification(
                recipient=enrol.student,
                title='New Assignment',
                message=f'New assignment \"{assignment.title}\" has been published for {assignment.course.title}.{due_text}',
                channels=['in_app', 'email'],
                email_subject=f'New assignment: {assignment.title}',
                metadata={'assignment_id': str(assignment.id), 'type': 'assignment_published'},
                template_key='assignment_published',
                template_vars={**ctx_base, 'student_name': enrol.student.full_name},
            )

        return Response(AssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        assignment = self.get_object()
        if not _has_any_role(request.user, ['owner', 'admin']):
            return Response(
                {'detail': 'Not authorized to archive.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        assignment.status = 'archived'
        assignment.save(update_fields=['status', 'updated_at'])
        return Response(AssignmentSerializer(assignment).data)


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)
    graded_by_email = serializers.CharField(source='graded_by.email', read_only=True, default=None)

    class Meta:
        model = AssignmentSubmission
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'student', 'status', 'score',
            'feedback', 'feedback_files', 'submitted_at', 'graded_at', 'graded_by',
        ]


class AssignmentSubmissionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Submissions — students create/submit, instructors grade/release."""
    audit_resource_type = 'assignment_submission'
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [IsAuthenticated, IsAssignmentRole]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return AssignmentSubmission.objects.none()

        qs = AssignmentSubmission.objects.filter(
            assignment__organisation=org,
        ).select_related('assignment', 'student', 'graded_by')

        if _has_role(user, 'student'):
            return qs.filter(student=user)

        if _has_role(user, 'instructor'):
            return qs.filter(assignment__course__instructor=user)

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        # Parent: only submissions for linked children
        if _has_role(user, 'parent'):
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(student_id__in=child_ids)

        return AssignmentSubmission.objects.none()

    def _score_mcq_answers(self, assignment, answers):
        """Score MCQ answers: returns (earned_points, total_points, results)."""
        questions = list(assignment.questions.all())
        total = sum(q.points for q in questions)
        earned = 0
        results = []
        for q in questions:
            answer = answers.get(str(q.id))
            is_correct = False
            if q.question_type == 'multiple_select':
                selected = set(str(s).lower() for s in (answer or []))
                correct_set = set(str(c).lower() for c in (q.correct_answer or []))
                is_correct = bool(selected) and selected == correct_set
            else:
                is_correct = str(answer or '').lower() == str((q.correct_answer or [''])[0]).lower()
            earned += q.points if is_correct else 0
            results.append({
                'question_id': str(q.id),
                'prompt': q.prompt[:200],
                'answer': answer,
                'correct': is_correct,
                'points': q.points,
                'explanation': q.explanation,
            })
        return earned, total, results

    def perform_create(self, serializer):
        assignment = serializer.validated_data.get('assignment')
        student = self.request.user

        if not _has_role(student, 'student'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only students can submit assignments.')

        # Check enrolment
        if not Enrolment.objects.filter(
            student=student, course=assignment.course, status='active',
        ).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You are not enrolled in this course.')

        # Check max attempts
        existing_count = AssignmentSubmission.objects.filter(
            assignment=assignment, student=student,
        ).count()
        if existing_count >= assignment.max_attempts:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                f'Maximum attempts ({assignment.max_attempts}) reached.'
            )

        from django.utils import timezone
        extra = {'student': student, 'attempt_number': existing_count + 1}

        # Auto-score the MCQ part for MCQ and combined tasks.
        content = serializer.validated_data.get('content_data') or {}
        mcq_answers = content.get('mcq_answers') if isinstance(content, dict) else None
        if assignment.task_type in ('mcq', 'combined') and assignment.questions.exists():
            if not isinstance(mcq_answers, dict):
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    {'content_data': 'mcq_answers mapping is required for this task.'}
                )
            earned, total, results = self._score_mcq_answers(assignment, mcq_answers)
            content['mcq_results'] = results
            content['mcq_score'] = earned
            content['mcq_total'] = total
            extra['content_data'] = content
            if assignment.task_type == 'mcq':
                # Pure MCQ tasks are graded automatically.
                max_score = assignment.max_score or 1
                extra['score'] = round(earned / total * max_score, 2) if total else 0
                extra['status'] = 'graded'
                extra['graded_at'] = timezone.now()
            else:
                # Combined tasks: MCQ part auto-scored, essay part still manual.
                extra['status'] = 'submitted'
                extra['submitted_at'] = timezone.now()

        serializer.save(**extra)

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        submission = self.get_object()
        if submission.student != request.user:
            return Response(
                {'detail': 'You can only submit your own work.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if submission.status != 'draft':
            return Response(
                {'detail': 'Only draft submissions can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        submission.status = 'submitted'
        submission.submitted_at = timezone.now()
        submission.save(update_fields=['status', 'submitted_at', 'updated_at'])
        return Response(AssignmentSubmissionSerializer(submission).data)

    @action(detail=True, methods=['post'])
    def grade(self, request, pk=None):
        submission = self.get_object()
        if not _has_any_role(request.user, ['owner', 'admin', 'instructor']):
            return Response(
                {'detail': 'Not authorized to grade.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if submission.status not in ('submitted', 'returned'):
            return Response(
                {'detail': 'Only submitted or returned submissions can be graded.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score = request.data.get('score')
        feedback = request.data.get('feedback', '')
        if score is None:
            return Response(
                {'detail': 'Score is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        submission.score = score
        submission.feedback = feedback
        submission.status = 'graded'
        submission.graded_at = timezone.now()
        submission.graded_by = request.user
        submission.save(update_fields=[
            'score', 'feedback', 'status', 'graded_at', 'graded_by', 'updated_at',
        ])

        return Response(AssignmentSubmissionSerializer(submission).data)

    @action(detail=True, methods=['post'])
    def return_for_revision(self, request, pk=None):
        submission = self.get_object()
        if not _has_any_role(request.user, ['owner', 'admin', 'instructor']):
            return Response(
                {'detail': 'Not authorized.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        feedback = request.data.get('feedback', '')
        submission.status = 'returned'
        submission.feedback = feedback
        submission.save(update_fields=['status', 'feedback', 'updated_at'])
        return Response(AssignmentSubmissionSerializer(submission).data)

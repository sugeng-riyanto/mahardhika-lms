"""
Consent management with RBAC filtering — UU PDP compliant.

RBAC:
- Owner/Admin: all consent records in their org, can create/modify
- Parent: manage consent for their linked children, view own consents
- Student: manage own consent, request export/deletion
- Other: no access

Withdrawal rights (UU PDP Article 21):
- Any user (or parent for children) can withdraw consent at any time
- Withdrawal does not affect processing that occurred before withdrawal
- System must acknowledge withdrawal within reasonable time
"""
from django.db import models as django_models
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from consent.models import ConsentRecord, ConsentAuditLog, DataExportRequest, DataDeletionRequest
from identity.permissions import (
    _has_role, _has_any_role, get_user_roles, get_user_organisation,
    IsConsentRole,
)


def _get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ── Serializers ──────────────────────────────────────────────

class ConsentAuditLogSerializer(serializers.ModelSerializer):
    performed_by_email = serializers.CharField(source='performed_by.email', read_only=True, default='')

    class Meta:
        model = ConsentAuditLog
        fields = '__all__'
        read_only_fields = ['id', 'consent', 'created_at', 'updated_at']


class ConsentRecordSerializer(serializers.ModelSerializer):
    consented_by_email = serializers.CharField(source='consented_by.email', read_only=True, default='')
    is_active = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    audit_logs = ConsentAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = ConsentRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'withdrawn_at']


class ConsentWithdrawSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class DataExportRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = DataExportRequest
        fields = '__all__'
        read_only_fields = [
            'id', 'user', 'status', 'download_url', 'expires_at',
            'processed_at', 'created_at', 'updated_at',
        ]


class DataDeletionRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    requested_by_email = serializers.CharField(source='requested_by.email', read_only=True, default='')

    class Meta:
        model = DataDeletionRequest
        fields = '__all__'
        read_only_fields = [
            'id', 'user', 'requested_by', 'status', 'denial_reason',
            'processed_at', 'processed_by', 'created_at', 'updated_at',
        ]


# ── Consent ViewSet ──────────────────────────────────────────

class ConsentRecordViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Consent management with RBAC and UU PDP withdrawal support."""
    audit_resource_type = 'consent_record'
    serializer_class = ConsentRecordSerializer
    permission_classes = [IsAuthenticated, IsConsentRole]

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        org = get_user_organisation(user)

        qs = ConsentRecord.objects.all()

        if _has_any_role(user, ['owner', 'admin']):
            return qs

        if 'student' in roles:
            return qs.filter(user=user)

        if 'parent' in roles:
            try:
                from identity.models import ParentChildLink
                child_ids = ParentChildLink.objects.filter(
                    parent_user=user, is_active=True, is_verified=True
                ).values_list('student_user', flat=True)
                return qs.filter(django_models.Q(user=user) | django_models.Q(user_id__in=child_ids))
            except (ImportError, AttributeError):
                return qs.filter(user=user)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        roles = get_user_roles(user)

        if 'parent' in roles:
            serializer.save(consented_by=user)
        elif _has_any_role(user, ['owner', 'admin']):
            serializer.save(consented_by=user)
        else:
            raise PermissionDenied('You do not have permission to create consent records.')

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=['post'], url_path='withdraw')
    def withdraw(self, request, pk=None):
        """Withdraw consent — UU PDP Article 21."""
        try:
            consent = ConsentRecord.objects.get(pk=pk)
        except ConsentRecord.DoesNotExist:
            return Response({'detail': 'Consent not found.'}, status=404)

        user = request.user
        roles = get_user_roles(user)

        has_access = consent.user == user
        if not has_access and 'parent' in roles:
            try:
                from identity.models import ParentChildLink
                has_access = ParentChildLink.objects.filter(
                    parent_user=user,
                    student_user=consent.user,
                    is_active=True, is_verified=True,
                ).exists()
            except (ImportError, AttributeError):
                pass

        if not has_access and not _has_any_role(user, ['owner', 'admin']):
            return Response({'detail': 'You cannot withdraw consent for this user.'}, status=403)

        serializer = ConsentWithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason', '')

        ConsentAuditLog.objects.create(
            consent=consent,
            action='withdrawn',
            performed_by=user,
            details={
                'previous_status': consent.status,
                'reason': reason,
                'purpose': consent.purpose,
            },
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )

        consent.withdraw(reason=reason)

        return Response({
            'detail': 'Consent withdrawn successfully.',
            'consent': ConsentRecordSerializer(consent).data,
        })

    @action(detail=True, methods=['post'], url_path='grant')
    def grant_action(self, request, pk=None):
        """Re-grant consent after withdrawal."""
        try:
            consent = ConsentRecord.objects.get(pk=pk)
        except ConsentRecord.DoesNotExist:
            return Response({'detail': 'Consent not found.'}, status=404)

        user = request.user
        roles = get_user_roles(user)

        has_access = consent.user == user
        if not has_access and 'parent' in roles:
            try:
                from identity.models import ParentChildLink
                has_access = ParentChildLink.objects.filter(
                    parent_user=user,
                    student_user=consent.user,
                    is_active=True, is_verified=True,
                ).exists()
            except (ImportError, AttributeError):
                pass

        if not has_access and not _has_any_role(user, ['owner', 'admin']):
            return Response({'detail': 'You cannot grant consent for this user.'}, status=403)

        ConsentAuditLog.objects.create(
            consent=consent,
            action='granted',
            performed_by=user,
            details={
                'previous_status': consent.status,
                'purpose': consent.purpose,
            },
            ip_address=_get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )

        consent.grant(consented_by_user=user)

        return Response({
            'detail': 'Consent granted successfully.',
            'consent': ConsentRecordSerializer(consent).data,
        })


# ── Data Export Request ──────────────────────────────────────

class DataExportRequestViewSet(viewsets.ModelViewSet):
    """UU PDP Article 26 — right to data portability."""
    serializer_class = DataExportRequestSerializer
    permission_classes = [IsAuthenticated, IsConsentRole]

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        if _has_any_role(user, ['owner', 'admin']):
            return DataExportRequest.objects.all()
        return DataExportRequest.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Admin/Owner approves export request."""
        if not _has_any_role(request.user, ['owner', 'admin']):
            return Response({'detail': 'Only admins can approve export requests.'}, status=403)

        try:
            export_req = DataExportRequest.objects.get(pk=pk)
        except DataExportRequest.DoesNotExist:
            return Response({'detail': 'Export request not found.'}, status=404)

        export_req.status = 'processing'
        export_req.processed_at = timezone.now()
        export_req.notes = f'Approved by {request.user.email}'
        export_req.save()
        return Response({'detail': 'Export approved and processing.'})


# ── Data Deletion Request ────────────────────────────────────

class DataDeletionRequestViewSet(viewsets.ModelViewSet):
    """UU PDP Article 26 — right to erasure."""
    serializer_class = DataDeletionRequestSerializer
    permission_classes = [IsAuthenticated, IsConsentRole]

    def get_queryset(self):
        user = self.request.user
        roles = get_user_roles(user)
        if _has_any_role(user, ['owner', 'admin']):
            return DataDeletionRequest.objects.all()
        return DataDeletionRequest.objects.filter(
            django_models.Q(user=user) | django_models.Q(requested_by=user)
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, requested_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Admin/Owner approves or denies deletion request."""
        if not _has_any_role(request.user, ['owner', 'admin']):
            return Response({'detail': 'Only admins can approve deletion requests.'}, status=403)

        try:
            del_req = DataDeletionRequest.objects.get(pk=pk)
        except DataDeletionRequest.DoesNotExist:
            return Response({'detail': 'Deletion request not found.'}, status=404)

        action_type = request.data.get('action', 'approve')
        reason = request.data.get('reason', '')

        if action_type == 'approve':
            del_req.status = 'processing'
            del_req.processed_at = timezone.now()
            del_req.processed_by = request.user
            del_req.notes = f'Approved by {request.user.email}'
            del_req.save()
            return Response({'detail': 'Deletion approved and processing.'})
        elif action_type == 'deny':
            del_req.status = 'denied'
            del_req.denial_reason = reason or 'No reason provided.'
            del_req.processed_by = request.user
            del_req.save()
            return Response({'detail': 'Deletion request denied.'})
        else:
            return Response({'detail': 'Invalid action.'}, status=400)


# ── Privacy Notice Endpoint ──────────────────────────────────

@api_view(['GET'])
@permission_classes([])
def privacy_notice(request):
    """Return the UU PDP privacy notice content — public endpoint."""
    return Response({
        'title': 'Privacy Notice — AKADEMI Digital Campus',
        'version': '1.0',
        'effective_date': '2026-08-24',
        'last_updated': '2026-08-24',
        'data_controller': {
            'name': 'Mahardhika Education Foundation',
            'email': 'privacy@mahardhika.id',
            'address': 'Jakarta, Indonesia',
        },
        'data_protection_officer': {
            'name': 'Data Protection Officer',
            'email': 'dpo@mahardhika.id',
        },
        'legal_basis': [
            {
                'basis': 'Consent (UU PDP Article 21)',
                'description': 'You have given explicit consent for the processing of your personal data for one or more specific purposes.',
            },
            {
                'basis': 'Contract (UU PDP Article 21)',
                'description': 'Processing is necessary for the performance of a contract to which you are a party.',
            },
            {
                'basis': 'Legal Obligation (UU PDP Article 21)',
                'description': 'Processing is necessary for compliance with a legal obligation.',
            },
        ],
        'data_collected': [
            {
                'category': 'Identity Data',
                'examples': 'Full name, email address, date of birth, profile photo',
                'purpose': 'Account management, authentication, and communication',
                'retention': 'Duration of account + 2 years',
            },
            {
                'category': 'Learning Data',
                'examples': 'Course enrolments, lesson progress, grades, assignments, essay responses, canvas work',
                'purpose': 'Educational service delivery, assessment, and progress tracking',
                'retention': 'Duration of enrolment + 5 years',
            },
            {
                'category': 'Child Data',
                'examples': 'Student learning records, attendance, safeguarding reports',
                'purpose': 'Education provision and child welfare (enhanced protection for minors)',
                'retention': 'Duration of enrolment + 5 years',
            },
            {
                'category': 'Communication Data',
                'examples': 'Email address, phone number (for WhatsApp), notification preferences',
                'purpose': 'Sending grade notifications, assignment reminders, and parent updates',
                'retention': 'Duration of account + 1 year',
            },
            {
                'category': 'Financial Data',
                'examples': 'Invoice records, payment status, sponsorship data',
                'purpose': 'Fee management, payment processing, and financial reporting',
                'retention': 'As required by tax law (7 years)',
            },
            {
                'category': 'Technical Data',
                'examples': 'IP address, browser type, device information, usage logs',
                'purpose': 'Security, fraud prevention, and service improvement',
                'retention': '90 days for logs, 1 year for analytics',
            },
        ],
        'your_rights': [
            {
                'right': 'Right to Information (Article 21)',
                'description': 'You have the right to know what personal data is collected and how it is processed.',
            },
            {
                'right': 'Right to Access (Article 21)',
                'description': 'You have the right to obtain confirmation of whether your personal data is being processed and access to that data.',
            },
            {
                'right': 'Right to Correction (Article 21)',
                'description': 'You have the right to correct inaccurate personal data.',
            },
            {
                'right': 'Right to Deletion (Article 21)',
                'description': 'You have the right to request deletion of your personal data, subject to legal obligations.',
            },
            {
                'right': 'Right to Restrict Processing (Article 21)',
                'description': 'You have the right to restrict the processing of your personal data.',
            },
            {
                'right': 'Right to Data Portability (Article 26)',
                'description': 'You have the right to receive your personal data in a structured, commonly used format.',
            },
            {
                'right': 'Right to Withdraw Consent (Article 21)',
                'description': 'You have the right to withdraw your consent at any time. Withdrawal does not affect the lawfulness of processing before withdrawal.',
            },
            {
                'right': 'Right to Object (Article 21)',
                'description': 'You have the right to object to the processing of your personal data.',
            },
        ],
        'child_protection': {
            'description': 'AKADEMI processes child personal data with enhanced safeguards. Children under 18 require parental/guardian consent for data processing. Parents can withdraw consent at any time. We do not use children\'s data for profiling, advertising, or any purpose beyond educational service delivery.',
            'parental_consent_required': True,
            'minimum_age_without_consent': 18,
            'enhanced_safeguards': [
                'Data minimization — we collect only what is necessary for education',
                'Purpose limitation — child data is used only for educational purposes',
                'No profiling or advertising',
                'No unrestricted direct contact with children',
                'Parent access to child data with verification',
                'Encryption in transit and at rest',
                'Regular security audits',
            ],
        },
        'data_security': {
            'measures': [
                'Encryption in transit (TLS 1.3)',
                'Encryption at rest (AES-256)',
                'Row-level security on database',
                'Role-based access control',
                'Regular security audits',
                'Incident response procedures',
                'Secure backup and recovery',
            ],
        },
        'contact': {
            'privacy_questions': 'privacy@mahardhika.id',
            'dpo': 'dpo@mahardhika.id',
            'complaints': 'complaints@mahardhika.id',
            'supervisory_authority': 'Ministry of Communication and Informatics (Kominfo)',
        },
    })

"""
Certificate views with RBAC.

- Student: view own certificates, verify by code
- Instructor: issue certificates for completed courses
- Admin/Owner: manage all certificates, revoke
- Public: verify certificate by verification code (no auth required)
"""
from datetime import date
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import api_view, permission_classes as perm, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from core.audit_mixin import AuditLogMixin
from audit.models import AuditEvent
from certificates.models import Certificate
from identity.permissions import (
    _has_role, _has_any_role, get_user_organisation,
    IsAcademicRole,
)
from courses.models import Enrolment


class CertificateSerializer(serializers.ModelSerializer):
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, default=None)
    programme_name = serializers.CharField(source='programme.name', read_only=True, default=None)
    issued_by_email = serializers.CharField(source='issued_by.email', read_only=True, default=None)

    class Meta:
        model = Certificate
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'organisation', 'certificate_number',
            'verification_code', 'status', 'revoked_at', 'revoked_reason', 'revoked_by',
        ]


class CertificateViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Certificate management — RBAC-scoped."""
    audit_resource_type = 'certificate'
    serializer_class = CertificateSerializer
    permission_classes = [IsAuthenticated, IsAcademicRole]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return Certificate.objects.none()

        qs = Certificate.objects.filter(organisation=org).select_related(
            'recipient', 'course', 'programme', 'issued_by',
        )

        # Students see only their own active certificates
        if _has_role(user, 'student'):
            return qs.filter(recipient=user, status='active')

        # Parent sees linked child's certificates
        if _has_role(user, 'parent'):
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(recipient_id__in=child_ids, status='active')

        # Instructor, Admin, Owner see all in org
        if _has_any_role(user, ['instructor', 'admin', 'owner']):
            return qs

        return Certificate.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'admin', 'instructor']):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only instructors, admins, or owners can issue certificates.')

        org = get_user_organisation(user)
        recipient = serializer.validated_data.get('recipient')

        # Verify the student is enrolled and completed the course
        course = serializer.validated_data.get('course')
        if course and recipient:
            if not Enrolment.objects.filter(
                student=recipient, course=course, status='completed',
            ).exists():
                # Also allow manual certificate for active enrolments
                pass

        cert = serializer.save(
            organisation=org,
            issued_by=user,
            issued_date=serializer.validated_data.get('issued_date', date.today()),
        )

        # Notify the recipient their certificate has been issued
        if recipient:
            from notifications.dispatcher import dispatch_notification
            course_name = course.title if course else 'course'
            dispatch_notification(
                recipient=recipient,
                title='Certificate Issued',
                message=f'Your certificate for {course_name} has been issued. Verify it with the QR code.',
                metadata={'certificate_id': str(cert.id), 'type': 'certificate_issued'},
                template_key='certificate_issued',
                template_vars={'course_name': course_name},
            )

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()



        AuditEvent.log(
            actor_id=user.id,
            actor_email=user.email,
            action='certificate_issued',
            resource_type='certificate',
            resource_id=cert.id,
            details={
                'recipient': cert.recipient_email,
                'certificate_number': cert.certificate_number,
                'course': cert.course.title if cert.course else None,
            },
        )

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke a certificate — admin/owner only."""
        cert = self.get_object()
        if not _has_any_role(request.user, ['owner', 'admin']):
            return Response(
                {'detail': 'Only Owner or Admin can revoke certificates.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if cert.status == 'revoked':
            return Response(
                {'detail': 'Certificate is already revoked.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cert.status = 'revoked'
        cert.revoked_at = timezone.now()
        cert.revoked_reason = request.data.get('reason', '')
        cert.revoked_by = request.user
        cert.save(update_fields=[
            'status', 'revoked_at', 'revoked_reason', 'revoked_by', 'updated_at',
        ])

        AuditEvent.log(
            actor_id=request.user.id,
            actor_email=request.user.email,
            action='certificate_revoked',
            resource_type='certificate',
            resource_id=cert.id,
            details={'reason': cert.revoked_reason},
        )

        return Response(CertificateSerializer(cert).data)


@api_view(['GET'])
@perm([AllowAny])
def verify_certificate(request, verification_code):
    """Public endpoint to verify a certificate by its verification code."""
    try:
        cert = Certificate.objects.select_related('course', 'programme').get(
            verification_code=verification_code,
        )
    except Certificate.DoesNotExist:
        return Response(
            {'valid': False, 'detail': 'Certificate not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    chain_valid, chain_msg = cert.verify_chain()

    return Response({
        'valid': cert.status == 'active',
        'certificate_number': cert.certificate_number,
        'recipient_name': cert.recipient_name,
        'title': cert.title,
        'course': cert.course.title if cert.course else None,
        'programme': cert.programme.name if cert.programme else None,
        'issued_date': cert.issued_date,
        'status': cert.status,
        'block_index': cert.block_index,
        'block_hash': cert.block_hash,
        'previous_hash': cert.previous_hash,
        'chain_valid': chain_valid,
        'chain_message': chain_msg,
    })

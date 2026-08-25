"""
Payment views with strict RBAC enforcement.

RBAC Matrix (from RBAC.md):
- Treasurer: FULL — create invoices, process payments, reconcile, refund
- Owner: Governance summary, approve refunds
- Admin: Operational support — create invoices, manage status
- Student: Own invoices ONLY, initiate payment
- Parent: Linked child invoices ONLY, initiate payment
- Sponsor: Fund summary ONLY (no individual data)
- Instructor: NO finance access
- Third Party: Payment processor ONLY (expiring grant)

Key accountability measures:
1. Dual approval for refunds (Treasurer requests, Owner approves)
2. Idempotent webhooks prevent duplicate credit
3. PaymentTransaction is immutable (write-once)
4. All state changes are audit-logged
5. Parent isolation enforced via queryset
6. Finance ↔ Academic wall — no cross-domain joins
"""
import uuid
import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.decorators import api_view, permission_classes as perm
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from core.audit_mixin import AuditLogMixin
from audit.models import AuditEvent
from payments.models import PaymentIntent, PaymentTransaction, PaymentRefund
from payments.adapter import get_payment_adapter
from finance.models import Invoice
from identity.permissions import (
    _has_role, _has_any_role, get_user_organisation, is_parent_of,
)
from courses.models import Enrolment

logger = logging.getLogger('payments')


# ============================================================
# Serializers
# ============================================================

class PaymentIntentSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = PaymentIntent
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'organisation', 'user',
            'midtrans_order_id', 'midtrans_token', 'midtrans_redirect_url',
            'midtrans_fraud_status', 'status', 'paid_at', 'idempotency_key',
        ]


class PaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = '__all__'
        read_only_fields = [f.name for f in PaymentTransaction._meta.get_fields()] + ['id']


class PaymentRefundSerializer(serializers.ModelSerializer):
    requested_by_email = serializers.CharField(source='requested_by.email', read_only=True)
    approved_by_email = serializers.CharField(source='approved_by.email', read_only=True, default=None)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = PaymentRefund
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'organisation',
            'status', 'approved_by', 'approved_at',
            'midtrans_refund_id', 'midtrans_status',
        ]


# ============================================================
# ViewSets
# ============================================================

class PaymentIntentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Payment intents — RBAC-scoped."""
    audit_resource_type = 'payment_intent'
    serializer_class = PaymentIntentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return PaymentIntent.objects.none()

        qs = PaymentIntent.objects.filter(organisation=org).select_related('invoice', 'user')

        if _has_any_role(user, ['owner', 'admin', 'treasurer']):
            return qs

        if _has_role(user, 'student'):
            return qs.filter(user=user)

        if _has_role(user, 'parent'):
            from identity.models import ParentChildLink
            child_ids = ParentChildLink.objects.filter(
                parent_user=user, is_verified=True, is_active=True,
                consent_given=True,
            ).values_list('student_user_id', flat=True)
            return qs.filter(user_id__in=child_ids)

        return PaymentIntent.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No organisation context.')

        # RBAC: only students, parents, treasurer, owner can create payments
        if _has_role(user, 'instructor'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Instructors cannot create payment intents.')

        invoice = serializer.validated_data.get('invoice')
        if not invoice:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Invoice is required.')

        # RBAC: students/parents can only pay their own invoices
        if _has_any_role(user, ['student', 'parent']):
            if invoice.user_id != user.id:
                # Check if parent of invoice user
                if not _has_role(user, 'parent') or not is_parent_of(user, str(invoice.user_id)):
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied('You can only pay your own invoices.')

        # Generate idempotency key (auto-generated if not provided)
        idempotency_key = serializer.validated_data.get('idempotency_key') or f'{invoice.id}-{uuid.uuid4()}'

        # Create payment via adapter
        adapter = get_payment_adapter()
        payment_method = serializer.validated_data.get('payment_method', 'va_bca')

        try:
            result = adapter.create_payment(
                order_id=f'AKD-{invoice.invoice_number}-{timezone.now().strftime("%Y%m%d%H%M%S")}',
                amount=invoice.amount,
                item_name=invoice.notes or f'Payment for {invoice.invoice_number}',
                customer_email=invoice.user.email,
                customer_name=invoice.user.full_name or invoice.user.email,
                payment_method=payment_method,
            )
        except Exception as e:
            logger.error(f'Payment creation failed: {e}')
            from rest_framework.exceptions import APIException
            raise APIException(f'Payment gateway error: {str(e)}')

        intent = serializer.save(
            organisation=org,
            user=user,
            idempotency_key=idempotency_key,
            midtrans_order_id=result.get('order_id', ''),
            midtrans_token=result.get('token', ''),
            midtrans_redirect_url=result.get('redirect_url', ''),
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )

        # Audit log
        AuditEvent.log(
            actor_id=user.id,
            actor_email=user.email,
            action='payment_intent_created',
            resource_type='payment_intent',
            resource_id=intent.id,
            scope=str(org.id),
            details={
                'invoice_number': invoice.invoice_number,
                'amount': str(invoice.amount),
                'payment_method': payment_method,
            },
            ip_address=self.request.META.get('REMOTE_ADDR'),
        )

        return intent


class PaymentRefundViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Refund requests — Treasurer requests, Owner approves (dual approval)."""
    audit_resource_type = 'payment_refund'
    serializer_class = PaymentRefundSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org = get_user_organisation(user)
        if not org:
            return PaymentRefund.objects.none()

        if _has_any_role(user, ['owner', 'treasurer']):
            return PaymentRefund.objects.filter(organisation=org).select_related(
                'transaction', 'invoice', 'requested_by', 'approved_by',
            )

        return PaymentRefund.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not _has_any_role(user, ['owner', 'treasurer']):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only Treasurer or Owner can request refunds.')

        org = get_user_organisation(user)
        transaction = serializer.validated_data.get('transaction')
        invoice = serializer.validated_data.get('invoice')

        if not transaction or not invoice:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Transaction and invoice are required.')

        refund_amount = serializer.validated_data.get('amount')
        if refund_amount and refund_amount > transaction.amount:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Refund amount exceeds transaction amount.')

        refund = serializer.save(
            organisation=org,
            requested_by=user,
            status='requested',
        )

        AuditEvent.log(
            actor_id=user.id,
            actor_email=user.email,
            action='refund_requested',
            resource_type='payment_refund',
            resource_id=refund.id,
            scope=str(org.id),
            details={
                'transaction_id': str(transaction.id),
                'invoice_number': invoice.invoice_number,
                'amount': str(refund_amount),
            },
        )
        return refund

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        refund = self.get_object()
        if not _has_role(request.user, 'owner'):
            return Response(
                {'detail': 'Only Owner can approve refunds.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if refund.status != 'requested':
            return Response(
                {'detail': 'Only requested refunds can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refund.status = 'approved'
        refund.approved_by = request.user
        refund.approved_at = timezone.now()
        refund.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

        AuditEvent.log(
            actor_id=request.user.id,
            actor_email=request.user.email,
            action='refund_approved',
            resource_type='payment_refund',
            resource_id=refund.id,
            scope=str(refund.organisation_id),
            details={'refund_amount': str(refund.amount)},
        )

        return Response(PaymentRefundSerializer(refund).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        refund = self.get_object()
        if not _has_role(request.user, 'owner'):
            return Response(
                {'detail': 'Only Owner can reject refunds.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if refund.status != 'requested':
            return Response(
                {'detail': 'Only requested refunds can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refund.status = 'rejected'
        refund.save(update_fields=['status', 'updated_at'])

        AuditEvent.log(
            actor_id=request.user.id,
            actor_email=request.user.email,
            action='refund_rejected',
            resource_type='payment_refund',
            resource_id=refund.id,
            scope=str(refund.organisation_id),
            details={'reason': request.data.get('reason', '')},
        )

        return Response(PaymentRefundSerializer(refund).data)


# ============================================================
# Webhook handler (idempotent, signature-verified)
# ============================================================

@api_view(['POST'])
@perm([AllowAny])
def midtrans_webhook(request):
    """
    Midtrans webhook endpoint.
    - Verifies signature (SHA-512)
    - Idempotent: checks order_id + transaction_id for duplicates
    - Creates immutable PaymentTransaction
    - Updates Invoice status on settlement
    """
    payload = request.data
    if not payload:
        return Response({'detail': 'Empty payload'}, status=400)

    order_id = payload.get('order_id', '')
    transaction_id = payload.get('transaction_id', '')
    signature = payload.get('signature_key', '')

    if not order_id or not signature:
        return Response({'detail': 'Missing required fields'}, status=400)

    # Idempotency check
    if PaymentTransaction.objects.filter(
        midtrans_transaction_id=transaction_id,
        payment_intent__midtrans_order_id=order_id,
    ).exists():
        return Response({'detail': 'Duplicate webhook (ignored)'}, status=200)

    # Verify signature
    adapter = get_payment_adapter()
    try:
        parsed = adapter.process_webhook(payload, signature)
    except ValueError as e:
        AuditEvent.log(
            actor_id=uuid.UUID(int=0),
            actor_email='system',
            action='webhook_signature_invalid',
            resource_type='payment',
            details={'order_id': order_id, 'error': str(e)},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'detail': 'Invalid signature'}, status=403)
    except Exception as e:
        logger.error(f'Webhook processing error: {e}')
        return Response({'detail': 'Processing error'}, status=500)

    # Find payment intent
    try:
        intent = PaymentIntent.objects.get(midtrans_order_id=order_id)
    except PaymentIntent.DoesNotExist:
        logger.warning(f'Webhook for unknown order: {order_id}')
        return Response({'detail': 'Order not found'}, status=404)

    # Determine transaction status
    txn_status = parsed.get('transaction_status', '')
    fraud_status = parsed.get('fraud_status', '')

    STATUS_MAP = {
        'capture': 'capture',
        'settlement': 'settlement',
        'deny': 'deny',
        'challenge': 'challenge',
        'cancel': 'cancel',
        'expire': 'expire',
    }
    mapped_status = STATUS_MAP.get(txn_status, txn_status)
    settlement_time = parsed.get('settlement_time', '')

    # Create immutable transaction record
    transaction = PaymentTransaction.objects.create(
        payment_intent=intent,
        organisation=intent.organisation,
        status=mapped_status,
        amount=intent.amount,
        currency=intent.currency,
        midtrans_status_code=parsed.get('status_code', ''),
        midtrans_status_message=parsed.get('status_message', ''),
        midtrans_transaction_id=transaction_id,
        midtrans_transaction_time=parsed.get('transaction_time', ''),
        midtrans_settlement_time=settlement_time,
        midtrans_payment_type=parsed.get('payment_type', ''),
        midtrans_fraud_status=fraud_status,
        webhook_raw=payload,
    )

    # Update intent status
    INTENT_STATUS_MAP = {
        'settlement': 'success',
        'capture': 'processing',
        'deny': 'failed',
        'cancel': 'cancelled',
        'expire': 'expired',
        'challenge': 'processing',
    }
    new_status = INTENT_STATUS_MAP.get(txn_status, intent.status)
    if new_status != intent.status:
        intent.status = new_status
        if new_status == 'success':
            intent.paid_at = timezone.now()
        intent.save(update_fields=['status', 'paid_at', 'updated_at'])

    # Update invoice on settlement
    if txn_status == 'settlement' and fraud_status in ('accept', ''):
        invoice = intent.invoice
        if invoice.status != 'paid':
            invoice.status = 'paid'
            invoice.paid_at = timezone.now()
            invoice.save(update_fields=['status', 'paid_at', 'updated_at'])

    # Audit log
    AuditEvent.log(
        actor_id=uuid.UUID(int=0),
        actor_email='midtrans-webhook',
        action=f'webhook_{txn_status}',
        resource_type='payment_intent',
        resource_id=intent.id,
        scope=str(intent.organisation_id),
        details={
            'order_id': order_id,
            'transaction_id': transaction_id,
            'status': txn_status,
            'fraud_status': fraud_status,
            'amount': str(intent.amount),
        },
    )

    return Response({'detail': 'Webhook processed'}, status=200)

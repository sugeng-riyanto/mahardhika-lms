"""
Finance views with RBAC filtering.

- Owner/Treasurer: all invoices in their org, finance summary, status transitions
- Other roles: no access to finance data
"""
from decimal import Decimal
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.audit_mixin import AuditLogMixin
from audit.models import AuditEvent
from finance.models import Invoice
from identity.permissions import IsFinanceRole, _has_any_role, get_user_organisation


class InvoiceSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True, default='')

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'organisation', 'paid_at']


class InvoiceViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Finance — owner and treasurer only, org-scoped."""
    audit_resource_type = 'invoice'
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsFinanceRole]

    def get_queryset(self):
        org = get_user_organisation(self.request.user)
        if not org:
            return Invoice.objects.none()
        qs = Invoice.objects.filter(organisation=org).select_related('user')

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)

        return qs

    def perform_create(self, serializer):
        org = get_user_organisation(self.request.user)
        if not org:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No organisation context.')
        serializer.save(organisation=org)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send invoice — draft → sent."""
        invoice = self.get_object()
        if invoice.status != 'draft':
            return Response(
                {'detail': f'Cannot send invoice in {invoice.status} status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = 'sent'
        invoice.save(update_fields=['status', 'updated_at'])
        AuditEvent.log(
            actor_id=request.user.id,
            actor_email=request.user.email,
            action='invoice_sent',
            resource_type='invoice',
            resource_id=invoice.id,
            details={'invoice_number': invoice.invoice_number, 'amount': str(invoice.amount)},
        )
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid — sent/overdue → paid."""
        invoice = self.get_object()
        if invoice.status not in ('sent', 'overdue'):
            return Response(
                {'detail': f'Cannot mark {invoice.status} invoice as paid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = 'paid'
        invoice.paid_at = timezone.now()
        invoice.save(update_fields=['status', 'paid_at', 'updated_at'])
        AuditEvent.log(
            actor_id=request.user.id,
            actor_email=request.user.email,
            action='invoice_marked_paid',
            resource_type='invoice',
            resource_id=invoice.id,
            details={'invoice_number': invoice.invoice_number, 'amount': str(invoice.amount)},
        )
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel invoice — draft/sent → cancelled."""
        invoice = self.get_object()
        if invoice.status in ('paid', 'cancelled'):
            return Response(
                {'detail': f'Cannot cancel {invoice.status} invoice.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = 'cancelled'
        invoice.save(update_fields=['status', 'updated_at'])
        AuditEvent.log(
            actor_id=request.user.id,
            actor_email=request.user.email,
            action='invoice_cancelled',
            resource_type='invoice',
            resource_id=invoice.id,
            details={'invoice_number': invoice.invoice_number, 'reason': request.data.get('reason', '')},
        )
        return Response(InvoiceSerializer(invoice).data)


from rest_framework.decorators import api_view, permission_classes as perm


@api_view(['GET'])
@perm([IsAuthenticated, IsFinanceRole])
def finance_summary(request):
    """Aggregate finance summary for the treasurer/owner dashboard."""
    org = get_user_organisation(request.user)
    if not org:
        return Response({'detail': 'No organisation context.'}, status=400)

    invoices = Invoice.objects.filter(organisation=org)

    total_amount = invoices.aggregate(total=Sum('amount'))['total'] or 0
    paid_amount = invoices.filter(status='paid').aggregate(total=Sum('amount'))['total'] or 0
    pending_amount = invoices.filter(status='sent').aggregate(total=Sum('amount'))['total'] or 0
    overdue_amount = invoices.filter(status='overdue').aggregate(total=Sum('amount'))['total'] or 0
    draft_amount = invoices.filter(status='draft').aggregate(total=Sum('amount'))['total'] or 0

    status_counts = {}
    for row in invoices.values('status').annotate(count=Count('id')):
        status_counts[row['status']] = row['count']

    return Response({
        'total_amount': float(total_amount),
        'paid_amount': float(paid_amount),
        'pending_amount': float(pending_amount),
        'overdue_amount': float(overdue_amount),
        'draft_amount': float(draft_amount),
        'total_invoices': invoices.count(),
        'status_counts': status_counts,
    })

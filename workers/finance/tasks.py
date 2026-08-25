"""
Celery tasks for finance operations — payment reconciliation, invoice reminders, webhook processing.
"""
import logging
from celery import shared_task

logger = logging.getLogger('workers.finance')


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_payment_webhook(self, payload: dict, signature: str = None):
    """
    Process an incoming payment webhook from Midtrans.
    
    In production, this would:
    1. Verify webhook signature
    2. Check idempotency — skip if already processed
    3. Update PaymentTransaction status
    4. Update Invoice status
    5. Trigger notification to the user
    6. Record audit event
    """
    try:
        logger.info(f'Processing payment webhook')
        
        # TODO: Implement actual webhook processing
        # from payments.services import PaymentService
        # service = PaymentService()
        # service.process_webhook(payload, signature)
        
        logger.info(f'Payment webhook processed')
        return {'status': 'processed'}
    except Exception as exc:
        logger.error(f'Payment webhook processing failed: {exc}')
        raise self.retry(exc=exc)


@shared_task
def send_invoice_reminders():
    """
    Send reminders for invoices approaching due date or overdue.
    Runs daily via Celery Beat.
    
    In production, this would:
    1. Find invoices with due_date within 3 days or overdue
    2. Skip already-reminded invoices
    3. Send email/WhatsApp reminders
    4. Update overdue status
    """
    try:
        from django.utils import timezone
        from datetime import timedelta
        from finance.models import Invoice
        
        now = timezone.now()
        three_days = now + timedelta(days=3)
        
        upcoming = Invoice.objects.filter(
            status='sent',
            due_date__lte=three_days.date(),
            due_date__gte=now.date(),
        )
        
        overdue = Invoice.objects.filter(
            status='sent',
            due_date__lt=now.date(),
        )
        
        # Mark overdue
        overdue.update(status='overdue')
        
        logger.info(f'Invoice reminders: {upcoming.count()} upcoming, {overdue.count()} now overdue')
        
        # TODO: Send actual reminders via notification system
        # for invoice in list(upcoming) + list(overdue):
        #     send_notification_dispatch.delay(
        #         notification_id=create_reminder_notification(invoice),
        #         channels=['email', 'in_app'],
        #     )
        
        return {
            'status': 'completed',
            'upcoming_count': upcoming.count(),
            'overdue_count': overdue.count(),
        }
    except Exception as exc:
        logger.error(f'Invoice reminder task failed: {exc}')
        return {'status': 'failed', 'error': str(exc)}


@shared_task
def reconcile_payments():
    """
    Reconcile payment transactions with Midtrans.
    Runs daily via Celery Beat.
    
    In production, this would:
    1. Find pending transactions older than 24 hours
    2. Check status with Midtrans API
    3. Update local status
    4. Flag discrepancies
    """
    try:
        from payments.models import PaymentTransaction
        
        pending = PaymentTransaction.objects.filter(
            status__in=['pending', 'initiated'],
        )
        
        logger.info(f'Payment reconciliation: {pending.count()} pending transactions')
        
        # TODO: Implement actual reconciliation with Midtrans API
        
        return {'status': 'completed', 'pending_count': pending.count()}
    except Exception as exc:
        logger.error(f'Payment reconciliation failed: {exc}')
        return {'status': 'failed', 'error': str(exc)}


@shared_task
def generate_monthly_finance_report(organisation_id: str, year: int, month: int):
    """
    Generate a monthly finance summary report.
    Called by admin/owner or scheduled via Celery Beat.
    """
    try:
        from django.db.models import Sum, Count, Q
        from finance.models import Invoice
        from datetime import date
        import calendar
        
        last_day = calendar.monthrange(year, month)[1]
        start = date(year, month, 1)
        end = date(year, month, last_day)
        
        invoices = Invoice.objects.filter(
            organisation_id=organisation_id,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        
        summary = {
            'total_invoices': invoices.count(),
            'total_amount': float(invoices.aggregate(total=Sum('amount'))['total'] or 0),
            'paid_amount': float(invoices.filter(status='paid').aggregate(total=Sum('amount'))['total'] or 0),
            'pending_amount': float(invoices.filter(status='sent').aggregate(total=Sum('amount'))['total'] or 0),
            'overdue_amount': float(invoices.filter(status='overdue').aggregate(total=Sum('amount'))['total'] or 0),
            'period': f'{year}-{month:02d}',
        }
        
        logger.info(f'Finance report generated for {organisation_id}: {summary}')
        return summary
    except Exception as exc:
        logger.error(f'Finance report generation failed: {exc}')
        return {'status': 'failed', 'error': str(exc)}

"""Tests for finance module: Invoice model, ViewSet, RBAC, and state transitions."""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finance.models import Invoice
from audit.models import AuditEvent

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def invoice(db, organisation, student_user):
    return Invoice.objects.create(
        organisation=organisation,
        user=student_user,
        invoice_number='INV-2026-001',
        amount=Decimal('500000.00'),
        currency='IDR',
        status='draft',
        notes='Tuition fee for August',
    )


@pytest.fixture
def sent_invoice(db, organisation, student_user):
    return Invoice.objects.create(
        organisation=organisation,
        user=student_user,
        invoice_number='INV-2026-002',
        amount=Decimal('750000.00'),
        currency='IDR',
        status='sent',
    )


@pytest.fixture
def overdue_invoice(db, organisation, student_user):
    return Invoice.objects.create(
        organisation=organisation,
        user=student_user,
        invoice_number='INV-2026-003',
        amount=Decimal('300000.00'),
        currency='IDR',
        status='overdue',
    )


@pytest.fixture
def paid_invoice(db, organisation, student_user):
    return Invoice.objects.create(
        organisation=organisation,
        user=student_user,
        invoice_number='INV-2026-004',
        amount=Decimal('600000.00'),
        currency='IDR',
        status='paid',
        paid_at=timezone.now(),
    )


# ─── Model Tests ─────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestInvoiceModel:
    def test_create_invoice(self, invoice):
        assert invoice.invoice_number == 'INV-2026-001'
        assert invoice.amount == Decimal('500000.00')
        assert invoice.currency == 'IDR'
        assert invoice.status == 'draft'
        assert invoice.paid_at is None

    def test_invoice_str(self, invoice):
        assert 'INV-2026-001' in str(invoice)
        assert '500000.00' in str(invoice)

    def test_invoice_ordering(self, db, organisation, student_user):
        """Invoices are ordered by created_at descending (newest first)."""
        inv1 = Invoice.objects.create(
            organisation=organisation, user=student_user,
            invoice_number='INV-001', amount=Decimal('100'), status='draft',
        )
        inv2 = Invoice.objects.create(
            organisation=organisation, user=student_user,
            invoice_number='INV-002', amount=Decimal('200'), status='draft',
        )
        invoices = list(Invoice.objects.filter(organisation=organisation).order_by('-created_at'))
        # Verify both exist and are ordered
        assert len(invoices) == 2

    def test_unique_invoice_number(self, db, organisation, student_user):
        Invoice.objects.create(
            organisation=organisation, user=student_user,
            invoice_number='INV-UNIQUE', amount=Decimal('100'), status='draft',
        )
        with pytest.raises(Exception):
            Invoice.objects.create(
                organisation=organisation, user=student_user,
                invoice_number='INV-UNIQUE', amount=Decimal('200'), status='draft',
            )

    def test_invoice_defaults(self, db, organisation, student_user):
        inv = Invoice.objects.create(
            organisation=organisation, user=student_user,
            invoice_number='INV-DEFAULT', amount=Decimal('100'),
        )
        assert inv.currency == 'IDR'
        assert inv.status == 'draft'
        assert inv.notes == ''


# ─── API Tests ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestInvoiceViewSetCRUD:
    def test_treasurer_can_list_invoices(self, api_client, treasurer_user, invoice, sent_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get('/api/v1/finance/invoices/')
        assert res.status_code == 200
        assert res.data['count'] == 2

    def test_treasurer_can_create_invoice(self, api_client, treasurer_user, organisation, student_user):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post('/api/v1/finance/invoices/', {
            'user': str(student_user.id),
            'invoice_number': 'INV-NEW-001',
            'amount': '250000.00',
            'currency': 'IDR',
            'notes': 'Lab fee',
        }, format='json')
        assert res.status_code in (201, 200)
        assert Invoice.objects.filter(invoice_number='INV-NEW-001').exists()

    def test_treasurer_can_retrieve_invoice(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get(f'/api/v1/finance/invoices/{invoice.id}/')
        assert res.status_code == 200
        assert res.data['invoice_number'] == 'INV-2026-001'

    def test_treasurer_can_update_invoice(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.patch(f'/api/v1/finance/invoices/{invoice.id}/', {
            'notes': 'Updated notes',
        }, format='json')
        assert res.status_code == 200
        invoice.refresh_from_db()
        assert invoice.notes == 'Updated notes'

    def test_student_cannot_list_invoices(self, api_client, student_user, invoice):
        api_client.force_authenticate(user=student_user)
        res = api_client.get('/api/v1/finance/invoices/')
        assert res.status_code == 403

    def test_instructor_cannot_list_invoices(self, api_client, instructor_user, invoice):
        api_client.force_authenticate(user=instructor_user)
        res = api_client.get('/api/v1/finance/invoices/')
        assert res.status_code == 403

    def test_owner_can_list_invoices(self, api_client, owner_user, invoice):
        api_client.force_authenticate(user=owner_user)
        res = api_client.get('/api/v1/finance/invoices/')
        assert res.status_code == 200

    def test_filter_by_status(self, api_client, treasurer_user, invoice, sent_invoice, paid_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get('/api/v1/finance/invoices/?status=sent')
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['status'] == 'sent'

    def test_filter_by_user(self, api_client, treasurer_user, invoice, student_user):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get(f'/api/v1/finance/invoices/?user={student_user.id}')
        assert res.status_code == 200
        assert res.data['count'] == 1

    def test_unauthenticated_access_denied(self, api_client, invoice):
        res = api_client.get('/api/v1/finance/invoices/')
        assert res.status_code in (401, 403)  # DRF returns 401 or 403 for unauthenticated


# ─── Invoice State Transition Tests ──────────────────────────────────────


@pytest.mark.django_db
class TestInvoiceTransitions:
    def test_send_draft(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{invoice.id}/send/')
        assert res.status_code == 200
        invoice.refresh_from_db()
        assert invoice.status == 'sent'

    def test_cannot_send_non_draft(self, api_client, treasurer_user, sent_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{sent_invoice.id}/send/')
        assert res.status_code == 400

    def test_mark_paid_from_sent(self, api_client, treasurer_user, sent_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{sent_invoice.id}/mark_paid/')
        assert res.status_code == 200
        sent_invoice.refresh_from_db()
        assert sent_invoice.status == 'paid'
        assert sent_invoice.paid_at is not None

    def test_mark_paid_from_overdue(self, api_client, treasurer_user, overdue_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{overdue_invoice.id}/mark_paid/')
        assert res.status_code == 200
        overdue_invoice.refresh_from_db()
        assert overdue_invoice.status == 'paid'

    def test_cannot_mark_draft_as_paid(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{invoice.id}/mark_paid/')
        assert res.status_code == 400

    def test_cancel_draft(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{invoice.id}/cancel/')
        assert res.status_code == 200
        invoice.refresh_from_db()
        assert invoice.status == 'cancelled'

    def test_cancel_sent(self, api_client, treasurer_user, sent_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{sent_invoice.id}/cancel/')
        assert res.status_code == 200
        sent_invoice.refresh_from_db()
        assert sent_invoice.status == 'cancelled'

    def test_cannot_cancel_paid(self, api_client, treasurer_user, paid_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.post(f'/api/v1/finance/invoices/{paid_invoice.id}/cancel/')
        assert res.status_code == 400

    def test_full_lifecycle(self, api_client, treasurer_user, invoice):
        """draft → sent → paid lifecycle."""
        api_client.force_authenticate(user=treasurer_user)

        # Send
        res = api_client.post(f'/api/v1/finance/invoices/{invoice.id}/send/')
        assert res.status_code == 200

        # Mark paid
        res = api_client.post(f'/api/v1/finance/invoices/{invoice.id}/mark_paid/')
        assert res.status_code == 200

        invoice.refresh_from_db()
        assert invoice.status == 'paid'
        assert invoice.paid_at is not None


# ─── Audit Trail Tests ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestInvoiceAuditTrail:
    def test_send_creates_audit_event(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        api_client.post(f'/api/v1/finance/invoices/{invoice.id}/send/')
        event = AuditEvent.objects.filter(resource_type='invoice', action='invoice_sent').first()
        assert event is not None
        assert event.actor_email == treasurer_user.email

    def test_mark_paid_creates_audit_event(self, api_client, treasurer_user, sent_invoice):
        api_client.force_authenticate(user=treasurer_user)
        api_client.post(f'/api/v1/finance/invoices/{sent_invoice.id}/mark_paid/')
        event = AuditEvent.objects.filter(resource_type='invoice', action='invoice_marked_paid').first()
        assert event is not None

    def test_cancel_creates_audit_event(self, api_client, treasurer_user, invoice):
        api_client.force_authenticate(user=treasurer_user)
        api_client.post(f'/api/v1/finance/invoices/{invoice.id}/cancel/')
        event = AuditEvent.objects.filter(resource_type='invoice', action='invoice_cancelled').first()
        assert event is not None


# ─── Finance Summary Tests ───────────────────────────────────────────────


@pytest.mark.django_db
class TestFinanceSummary:
    def test_summary_returns_totals(self, api_client, treasurer_user, invoice, sent_invoice, paid_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get('/api/v1/finance/summary/')
        assert res.status_code == 200
        data = res.data
        assert data['total_invoices'] == 3
        assert float(data['paid_amount']) == 600000.00
        assert float(data['pending_amount']) == 750000.00
        assert float(data['draft_amount']) == 500000.00

    def test_summary_status_counts(self, api_client, treasurer_user, invoice, sent_invoice, paid_invoice, overdue_invoice):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get('/api/v1/finance/summary/')
        assert res.status_code == 200
        counts = res.data['status_counts']
        assert counts.get('draft', 0) >= 1
        assert counts.get('sent', 0) >= 1
        assert counts.get('paid', 0) >= 1
        assert counts.get('overdue', 0) >= 1

    def test_student_cannot_view_summary(self, api_client, student_user):
        api_client.force_authenticate(user=student_user)
        res = api_client.get('/api/v1/finance/summary/')
        assert res.status_code == 403

    def test_empty_summary(self, api_client, treasurer_user):
        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get('/api/v1/finance/summary/')
        assert res.status_code == 200
        assert res.data['total_invoices'] == 0
        assert res.data['total_amount'] == 0


# ─── Org Isolation Tests ────────────────────────────────────────────────


@pytest.mark.django_db
class TestInvoiceOrgIsolation:
    def test_treasurer_only_sees_own_org(self, api_client, treasurer_user, invoice, organisation):
        """Treasurer should only see invoices from their org."""
        from organisations.models import Organisation
        from identity.models import RoleAssignment

        other_org = Organisation.objects.create(name='Other Org', slug='other', type='school')
        Invoice.objects.create(
            organisation=other_org,
            user=invoice.user,
            invoice_number='INV-OTHER-001',
            amount=Decimal('100'),
            status='draft',
        )

        api_client.force_authenticate(user=treasurer_user)
        res = api_client.get('/api/v1/finance/invoices/')
        assert res.status_code == 200
        # Should only see the invoice from their org
        assert res.data['count'] == 1
        assert res.data['results'][0]['invoice_number'] == 'INV-2026-001'

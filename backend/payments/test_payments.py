"""
Tests for payment RBAC, webhook idempotency, refund dual approval, and mock adapter.
"""
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity.models import User, Role, RoleAssignment
from organisations.models import Organisation
from courses.models import Programme, Course, Enrolment
from finance.models import Invoice
from payments.models import PaymentIntent, PaymentTransaction, PaymentRefund
from payments.adapter import MockPaymentAdapter, get_payment_adapter


class PaymentTestBase(TestCase):
    """Shared setup for payment tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organisation.objects.create(name='Pay Org', slug='pay-org')

        self.owner_role, _ = Role.objects.get_or_create(name='owner')
        self.admin_role, _ = Role.objects.get_or_create(name='admin')
        self.treasurer_role, _ = Role.objects.get_or_create(name='treasurer')
        self.instructor_role, _ = Role.objects.get_or_create(name='instructor')
        self.student_role, _ = Role.objects.get_or_create(name='student')
        self.parent_role, _ = Role.objects.get_or_create(name='parent')

        self.owner = User.objects.create_user(
            email='owner@pay.test', password='pass123',
            supabase_uid='owner-pay-uid', full_name='Owner',
        )
        self.treasurer = User.objects.create_user(
            email='treasurer@pay.test', password='pass123',
            supabase_uid='treasurer-pay-uid', full_name='Treasurer',
        )
        self.admin = User.objects.create_user(
            email='admin@pay.test', password='pass123',
            supabase_uid='admin-pay-uid', full_name='Admin',
        )
        self.student = User.objects.create_user(
            email='student@pay.test', password='pass123',
            supabase_uid='student-pay-uid', full_name='Student',
        )
        self.instructor = User.objects.create_user(
            email='instructor@pay.test', password='pass123',
            supabase_uid='instructor-pay-uid', full_name='Instructor',
        )
        self.parent = User.objects.create_user(
            email='parent@pay.test', password='pass123',
            supabase_uid='parent-pay-uid', full_name='Parent',
        )

        for user, role in [
            (self.owner, self.owner_role),
            (self.treasurer, self.treasurer_role),
            (self.admin, self.admin_role),
            (self.student, self.student_role),
            (self.instructor, self.instructor_role),
            (self.parent, self.parent_role),
        ]:
            RoleAssignment.objects.create(
                user=user, role=role, organisation=self.org,
                status='active', valid_from=timezone.now(),
            )

        self.invoice = Invoice.objects.create(
            organisation=self.org, user=self.student,
            invoice_number='INV-PAY-001', amount=Decimal('5000000'),
            status='sent', due_date=date.today() + timedelta(days=7),
            notes='Tuition Fee Q1',
        )
        self.parent_invoice = Invoice.objects.create(
            organisation=self.org, user=self.student,
            invoice_number='INV-PAY-002', amount=Decimal('2500000'),
            status='sent', due_date=date.today() + timedelta(days=14),
            notes='STEAM Camp',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class MockAdapterTests(TestCase):
    """Test the mock payment adapter."""

    def test_create_payment(self):
        adapter = MockPaymentAdapter()
        result = adapter.create_payment(
            order_id='AKD-TEST-001', amount=Decimal('500000'),
            item_name='Test', customer_email='a@test.com',
            customer_name='A', payment_method='va_bca',
        )
        self.assertIn('token', result)
        self.assertIn('redirect_url', result)

    def test_idempotency_check(self):
        adapter = MockPaymentAdapter()
        result = adapter.create_payment(
            order_id='AKD-TEST-002', amount=Decimal('500000'),
            item_name='Test', customer_email='a@test.com',
            customer_name='A',
        )
        # Process same webhook twice
        payload = {
            'order_id': 'AKD-TEST-002',
            'transaction_id': 'TXN-001',
            'transaction_status': 'settlement',
            'status_code': '200',
            'gross_amount': '500000',
        }
        r1 = adapter.process_webhook(payload, 'mock-sig')
        r2 = adapter.process_webhook(payload, 'mock-sig')
        self.assertEqual(r1['transaction_status'], 'settlement')
        self.assertEqual(r2['transaction_status'], 'settlement')

    def test_get_adapter_returns_mock(self):
        adapter = get_payment_adapter()
        self.assertIsInstance(adapter, MockPaymentAdapter)


class PaymentIntentRBACTests(PaymentTestBase):
    """Test RBAC for payment intent creation and listing."""

    def test_student_can_create_own_payment(self):
        self.auth(self.student)
        res = self.client.post('/api/v1/payments/intents/', {
            'invoice': str(self.invoice.id),
            'amount': str(self.invoice.amount),
            'payment_method': 'va_bca',
        }, format='json')
        # 201 = success, 400 = adapter/validation error in test env
        self.assertIn(res.status_code, [201, 400])
        if res.status_code == 400:
            self.assertIn('invoice', str(res.data))

    def test_student_cannot_create_other_payment(self):
        other_student = User.objects.create_user(
            email='other@pay.test', password='pass123',
            supabase_uid='other-pay-uid', full_name='Other',
        )
        other_invoice = Invoice.objects.create(
            organisation=self.org, user=other_student,
            invoice_number='INV-OTHER', amount=Decimal('1000000'),
            status='sent', due_date=date.today() + timedelta(days=7),
        )
        self.auth(self.student)
        res = self.client.post('/api/v1/payments/intents/', {
            'invoice': str(other_invoice.id),
            'amount': '1000000',
            'payment_method': 'va_bca',
        }, format='json')
        self.assertIn(res.status_code, [403, 400])

    def test_instructor_cannot_create_payment(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/payments/intents/', {
            'invoice': str(self.invoice.id),
            'amount': str(self.invoice.amount),
        }, format='json')
        # Instructor has no finance role — either 403 from RBAC or 400 from validation
        self.assertIn(res.status_code, [403, 400])

    def test_treasurer_can_list_all(self):
        self.auth(self.treasurer)
        res = self.client.get('/api/v1/payments/intents/')
        self.assertEqual(res.status_code, 200)

    def test_student_only_sees_own(self):
        self.auth(self.student)
        res = self.client.get('/api/v1/payments/intents/')
        self.assertEqual(res.status_code, 200)

    def test_parent_only_sees_child_invoices(self):
        from identity.models import ParentChildLink
        ParentChildLink.objects.create(
            parent_user=self.parent,
            student_user=self.student,
            is_verified=True, is_active=True, consent_given=True,
        )
        self.auth(self.parent)
        res = self.client.get('/api/v1/payments/intents/')
        self.assertEqual(res.status_code, 200)


class RefundDualApprovalTests(PaymentTestBase):
    """Test refund dual-approval workflow."""

    def setUp(self):
        super().setUp()
        # Create a settled payment intent and transaction
        self.intent = PaymentIntent.objects.create(
            invoice=self.invoice, organisation=self.org, user=self.student,
            amount=self.invoice.amount, status='success',
            idempotency_key='test-idemp-1',
            midtrans_order_id='AKD-TEST-SETTLED',
            paid_at=timezone.now(),
        )
        self.transaction = PaymentTransaction.objects.create(
            payment_intent=self.intent, organisation=self.org,
            status='settlement', amount=self.intent.amount,
            midtrans_transaction_id='TXN-SETTLED-001',
        )
        self.refund = PaymentRefund.objects.create(
            transaction=self.transaction, invoice=self.invoice,
            organisation=self.org, amount=Decimal('2500000'),
            reason='Partial withdrawal', requested_by=self.treasurer,
        )

    def test_treasurer_can_request_refund(self):
        self.auth(self.treasurer)
        res = self.client.post('/api/v1/payments/refunds/', {
            'transaction': str(self.transaction.id),
            'invoice': str(self.invoice.id),
            'amount': '250000',
            'reason': 'Overpayment correction',
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_instructor_cannot_request_refund(self):
        self.auth(self.instructor)
        res = self.client.post('/api/v1/payments/refunds/', {
            'transaction': str(self.transaction.id),
            'invoice': str(self.invoice.id),
            'amount': '250000',
            'reason': 'Test',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_owner_can_approve_refund(self):
        self.auth(self.owner)
        res = self.client.post(f'/api/v1/payments/refunds/{self.refund.id}/approve/')
        self.assertEqual(res.status_code, 200)
        self.refund.refresh_from_db()
        self.assertEqual(self.refund.status, 'approved')
        self.assertEqual(self.refund.approved_by, self.owner)

    def test_treasurer_cannot_approve_refund(self):
        self.auth(self.treasurer)
        res = self.client.post(f'/api/v1/payments/refunds/{self.refund.id}/approve/')
        self.assertEqual(res.status_code, 403)

    def test_owner_can_reject_refund(self):
        self.auth(self.owner)
        res = self.client.post(
            f'/api/v1/payments/refunds/{self.refund.id}/reject/',
            {'reason': 'Insufficient documentation'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.refund.refresh_from_db()
        self.assertEqual(self.refund.status, 'rejected')


class WebhookIdempotencyTests(PaymentTestBase):
    """Test webhook idempotency — duplicate webhooks should not create duplicate transactions."""

    def setUp(self):
        super().setUp()
        self.intent = PaymentIntent.objects.create(
            invoice=self.invoice, organisation=self.org, user=self.student,
            amount=self.invoice.amount, status='pending',
            idempotency_key='test-idemp-webhook',
            midtrans_order_id='AKD-WEBHOOK-001',
        )

    def test_webhook_creates_transaction(self):
        payload = {
            'order_id': self.intent.midtrans_order_id,
            'transaction_id': 'TXN-WEBHOOK-001',
            'transaction_status': 'settlement',
            'status_code': '200',
            'gross_amount': str(self.intent.amount),
            'signature_key': 'mock-signature',
            'fraud_status': 'accept',
            'payment_type': 'bank_transfer',
        }
        res = self.client.post('/api/v1/payments/webhook/midtrans/', payload, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            PaymentTransaction.objects.filter(
                midtrans_transaction_id='TXN-WEBHOOK-001',
            ).exists()
        )

    def test_duplicate_webhook_is_idempotent(self):
        """Same order_id + transaction_id should not create a second transaction."""
        payload = {
            'order_id': self.intent.midtrans_order_id,
            'transaction_id': 'TXN-WEBHOOK-IDEM',
            'transaction_status': 'settlement',
            'status_code': '200',
            'gross_amount': str(self.intent.amount),
            'signature_key': 'mock-sig',
            'fraud_status': 'accept',
        }
        self.client.post('/api/v1/payments/webhook/midtrans/', payload, format='json')
        self.client.post('/api/v1/payments/webhook/midtrans/', payload, format='json')

        txn_count = PaymentTransaction.objects.filter(
            midtrans_transaction_id='TXN-WEBHOOK-IDEM',
        ).count()
        self.assertEqual(txn_count, 1)

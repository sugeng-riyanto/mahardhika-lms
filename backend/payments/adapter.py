import hashlib
import hmac
import os
import logging
from abc import ABC, abstractmethod
from decimal import Decimal
from datetime import datetime, timedelta

logger = logging.getLogger('payments')


class PaymentAdapter(ABC):
    """Abstract payment adapter interface."""

    @abstractmethod
    def create_payment(self, order_id: str, amount: Decimal, item_name: str,
                       customer_email: str, customer_name: str,
                       payment_method: str = '', **kwargs) -> dict:
        """Create a payment and return token + redirect URL."""
        pass

    @abstractmethod
    def get_payment_status(self, order_id: str) -> dict:
        """Get current payment status."""
        pass

    @abstractmethod
    def process_webhook(self, payload: dict, signature: str) -> dict:
        """Verify webhook signature and return parsed data."""
        pass

    @abstractmethod
    def process_refund(self, transaction_id: str, amount: Decimal, reason: str) -> dict:
        """Process a refund."""
        pass


class MidtransAdapter(PaymentAdapter):
    """Production Midtrans payment adapter using REST API v2."""

    def __init__(self):
        self.server_key = os.environ.get('MIDTRANS_SERVER_KEY', '')
        self.client_key = os.environ.get('MIDTRANS_CLIENT_KEY', '')
        self.is_production = os.environ.get('MIDTRANS_PRODUCTION', 'false').lower() == 'true'
        self.api_url = (
            'https://api.midtrans.com' if self.is_production
            else 'https://api.sandbox.midtrans.com'
        )
        self.payment_url = (
            'https://app.midtrans.com' if self.is_production
            else 'https://app.sandbox.midtrans.com'
        )

    def _auth_header(self) -> dict:
        import base64
        encoded = base64.b64encode(f'{self.server_key}:'.encode()).decode()
        return {'Authorization': f'Basic {encoded}', 'Content-Type': 'application/json'}

    def create_payment(self, order_id: str, amount: Decimal, item_name: str,
                       customer_email: str, customer_name: str,
                       payment_method: str = '', **kwargs) -> dict:
        import requests

        payload = {
            'transaction_details': {
                'order_id': order_id,
                'gross_amount': int(amount),
            },
            'item_details': [{
                'id': 'tuition',
                'price': int(amount),
                'quantity': 1,
                'name': item_name,
            }],
            'customer_details': {
                'email': customer_email,
                'first_name': customer_name,
            },
            'expiry': {
                'unit': 'hour',
                'duration': kwargs.get('expiry_hours', 24),
            },
        }

        # Add payment-specific parameters
        if payment_method.startswith('va_'):
            bank = payment_method.replace('va_', '')
            payload['payment_type'] = 'bank_transfer'
            payload['bank_transfer'] = {'bank': bank}
        elif payment_method in ('gopay', 'ovo', 'dana', 'shopeepay'):
            payload['payment_type'] = payment_method
        elif payment_method == 'qris':
            payload['payment_type'] = 'qris'
        elif payment_method == 'credit_card':
            payload['payment_type'] = 'credit_card'
        elif payment_method in ('indomaret', 'alfamart'):
            payload['payment_type'] = 'cstore'
            payload['cstore'] = {'store': payment_method}
        else:
            payload['payment_type'] = 'bank_transfer'
            payload['bank_transfer'] = {'bank': 'bca'}

        resp = requests.post(
            f'{self.api_url}/v2/payment-links',
            json=payload,
            headers=self._auth_header(),
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        return {
            'token': data.get('token', ''),
            'redirect_url': data.get('redirect_url', ''),
            'order_id': order_id,
        }

    def get_payment_status(self, order_id: str) -> dict:
        import requests

        resp = requests.get(
            f'{self.api_url}/v2/{order_id}/status',
            headers=self._auth_header(),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def process_webhook(self, payload: dict, signature: str) -> dict:
        """Verify Midtrans webhook signature (SHA-512)."""
        order_id = payload.get('order_id', '')
        status_code = payload.get('status_code', '')
        gross_amount = payload.get('gross_amount', '')
        server_key = self.server_key

        # Midtrans signature: SHA512(order_id + status_code + gross_amount + server_key)
        signature_str = f'{order_id}{status_code}{gross_amount}{server_key}'
        expected_sig = hashlib.sha512(signature_str.encode()).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            raise ValueError('Invalid webhook signature')

        return {
            'order_id': order_id,
            'transaction_id': payload.get('transaction_id', ''),
            'transaction_status': payload.get('transaction_status', ''),
            'status_code': status_code,
            'gross_amount': gross_amount,
            'payment_type': payload.get('payment_type', ''),
            'fraud_status': payload.get('fraud_status', ''),
            'transaction_time': payload.get('transaction_time', ''),
            'settlement_time': payload.get('settlement_time', ''),
            'signature': signature,
        }

    def process_refund(self, transaction_id: str, amount: Decimal, reason: str) -> dict:
        import requests

        resp = requests.post(
            f'{self.api_url}/v2/{transaction_id}/refund',
            json={
                'refund_amount': int(amount),
                'reason': reason,
            },
            headers=self._auth_header(),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()


class MockPaymentAdapter(PaymentAdapter):
    """Mock payment adapter for development — no external API calls."""

    def __init__(self):
        self._payments: dict = {}
        self._refunds: dict = {}

    def create_payment(self, order_id: str, amount: Decimal, item_name: str,
                       customer_email: str, customer_name: str,
                       payment_method: str = '', **kwargs) -> dict:
        self._payments[order_id] = {
            'order_id': order_id,
            'status': 'pending',
            'amount': amount,
            'payment_method': payment_method or 'va_bca',
            'expires_at': datetime.now() + timedelta(hours=24),
        }
        return {
            'token': f'mock-token-{order_id}',
            'redirect_url': f'https://app.midtrans.com/payment/mock/{order_id}',
            'order_id': order_id,
        }

    def get_payment_status(self, order_id: str) -> dict:
        payment = self._payments.get(order_id, {})
        return {
            'order_id': order_id,
            'transaction_status': payment.get('status', 'pending'),
            'status_code': '200',
            'gross_amount': str(payment.get('amount', 0)),
        }

    def process_webhook(self, payload: dict, signature: str) -> dict:
        """Mock webhook — accept any signature."""
        order_id = payload.get('order_id', '')
        status = payload.get('transaction_status', 'settlement')

        # Update mock status
        if order_id in self._payments:
            self._payments[order_id]['status'] = status

        return {
            'order_id': order_id,
            'transaction_id': payload.get('transaction_id', f'mock-txn-{order_id}'),
            'transaction_status': status,
            'status_code': payload.get('status_code', '200'),
            'gross_amount': payload.get('gross_amount', '0'),
            'payment_type': payload.get('payment_type', 'bank_transfer'),
            'fraud_status': payload.get('fraud_status', 'accept'),
            'transaction_time': payload.get('transaction_time', ''),
            'settlement_time': payload.get('settlement_time', ''),
            'signature': signature,
        }

    def process_refund(self, transaction_id: str, amount: Decimal, reason: str) -> dict:
        refund_id = f'mock-refund-{transaction_id}'
        self._refunds[refund_id] = {
            'id': refund_id,
            'status': 'processed',
            'amount': amount,
        }
        return {
            'id': refund_id,
            'status': 'success',
            'refund_amount': str(amount),
        }


def get_payment_adapter() -> PaymentAdapter:
    """Get the appropriate payment adapter based on environment."""
    provider = os.environ.get('PAYMENT_PROVIDER', 'mock')
    if provider == 'midtrans':
        adapter = MidtransAdapter()
        if not adapter.server_key:
            logger.warning('MIDTRANS_SERVER_KEY not set, falling back to mock adapter')
            return MockPaymentAdapter()
        return adapter
    return MockPaymentAdapter()

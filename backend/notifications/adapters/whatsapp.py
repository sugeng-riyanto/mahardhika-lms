"""
WhatsApp notification adapter.

Providers:
    mock          — logs to console, stores in memory for dev/testing
    wa_cloud_api  — Meta WhatsApp Business Cloud API (placeholder for production)
"""
import logging
import uuid
from dataclasses import dataclass, field
from typing import Optional

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('notifications.whatsapp')


@dataclass
class WhatsAppMessage:
    """Structured WhatsApp message."""
    to_phone: str
    body: str
    template_name: str = ''
    template_vars: dict = field(default_factory=dict)
    media_url: str = ''
    media_type: str = 'image'
    metadata: dict = field(default_factory=dict)


class WhatsAppResult:
    """Result of a WhatsApp send attempt."""
    def __init__(self, success: bool, provider: str, message_id: str = '', error: str = '', sent_at=None):
        self.success = success
        self.provider = provider
        self.message_id = message_id
        self.error = error
        self.sent_at = sent_at or timezone.now()

    def to_dict(self):
        return {
            'success': self.success,
            'provider': self.provider,
            'message_id': self.message_id,
            'error': self.error,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
        }


# ─── MOCK PROVIDER ───────────────────────────────────────────────

class MockWhatsAppProvider:
    """
    Mock WhatsApp provider for development.
    Logs messages to console and stores for verification.
    No actual messages are sent.
    """

    def __init__(self):
        self.sent_messages: list[dict] = []

    def send(self, message: WhatsAppMessage) -> WhatsAppResult:
        """Log the message and store it for verification."""
        message_id = f'mock-wa-{uuid.uuid4().hex[:12]}'

        record = {
            'message_id': message_id,
            'to': message.to_phone,
            'body': message.body,
            'template_name': message.template_name,
            'template_vars': message.template_vars,
            'media_url': message.media_url,
            'metadata': message.metadata,
            'sent_at': timezone.now().isoformat(),
        }
        self.sent_messages.append(record)

        logger.info(
            'MOCK WHATSAPP → to=%s body="%s" id=%s',
            message.to_phone, message.body[:50], message_id,
        )

        return WhatsAppResult(
            success=True,
            provider='mock',
            message_id=message_id,
        )

    def get_sent_messages(self):
        """Return all sent messages (for testing)."""
        return list(self.sent_messages)

    def clear(self):
        """Clear sent messages (for test isolation)."""
        self.sent_messages.clear()


# ─── WHATSAPP CLOUD API PROVIDER ─────────────────────────────────

class WACloudAPIProvider:
    """
    Meta WhatsApp Business Cloud API provider.
    Placeholder — requires WABA token and phone number ID in settings.
    """

    def send(self, message: WhatsAppMessage) -> WhatsAppResult:
        api_token = getattr(settings, 'WHATSAPP_API_TOKEN', '')
        phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')

        if not api_token or not phone_number_id:
            return WhatsAppResult(
                success=False,
                provider='wa_cloud_api',
                error='WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be configured',
            )

        import requests

        url = f'https://graph.facebook.com/v18.0/{phone_number_id}/messages'
        headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json',
        }

        # Use template message if template_name provided
        if message.template_name:
            payload = {
                'messaging_product': 'whatsapp',
                'to': message.to_phone,
                'type': 'template',
                'template': {
                    'name': message.template_name,
                    'language': {'code': 'en'},
                    'components': [],
                },
            }
            # Add template variables
            if message.template_vars:
                params = [
                    {'type': 'text', 'text': str(v)}
                    for v in message.template_vars.values()
                ]
                payload['template']['components'].append({
                    'type': 'body',
                    'parameters': params,
                })
        else:
            payload = {
                'messaging_product': 'whatsapp',
                'to': message.to_phone,
                'type': 'text',
                'text': {'body': message.body},
            }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            message_id = data.get('messages', [{}])[0].get('id', '')

            logger.info(
                'WA CLOUD API → to=%s id=%s',
                message.to_phone, message_id,
            )

            return WhatsAppResult(
                success=True,
                provider='wa_cloud_api',
                message_id=message_id,
            )

        except Exception as e:
            logger.error(
                'WA CLOUD API FAILED → to=%s error=%s',
                message.to_phone, str(e),
            )
            return WhatsAppResult(
                success=False,
                provider='wa_cloud_api',
                error=str(e),
            )


# ─── PROVIDER FACTORY ────────────────────────────────────────────

_mock_provider = None
_wa_cloud_provider = None


def get_whatsapp_provider():
    """Get the configured WhatsApp provider."""
    global _mock_provider, _wa_cloud_provider

    provider_name = getattr(settings, 'WHATSAPP_PROVIDER', 'mock')

    if provider_name == 'mock':
        if _mock_provider is None:
            _mock_provider = MockWhatsAppProvider()
        return _mock_provider
    elif provider_name == 'wa_cloud_api':
        if _wa_cloud_provider is None:
            _wa_cloud_provider = WACloudAPIProvider()
        return _wa_cloud_provider
    else:
        logger.warning('Unknown WhatsApp provider "%s", falling back to mock', provider_name)
        if _mock_provider is None:
            _mock_provider = MockWhatsAppProvider()
        return _mock_provider


def send_whatsapp(
    to_phone: str,
    body: str,
    template_name: str = '',
    template_vars: Optional[dict] = None,
    media_url: str = '',
    metadata: Optional[dict] = None,
) -> WhatsAppResult:
    """Convenience function to send a WhatsApp message."""
    message = WhatsAppMessage(
        to_phone=to_phone,
        body=body,
        template_name=template_name,
        template_vars=template_vars or {},
        media_url=media_url,
        metadata=metadata or {},
    )
    return get_whatsapp_provider().send(message)

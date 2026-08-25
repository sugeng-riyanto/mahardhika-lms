"""
Email notification adapter.

Providers:
    mock  — logs to console, stores in SentEmail for dev/testing
    smtp  — sends via SMTP (production)
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dataclasses import dataclass, field
from typing import Optional

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('notifications.email')


@dataclass
class EmailMessage:
    """Structured email message."""
    to_email: str
    subject: str
    body: str
    html_body: str = ''
    from_email: str = ''
    from_name: str = 'AKADEMI Digital Campus'
    reply_to: str = ''
    metadata: dict = field(default_factory=dict)


class EmailResult:
    """Result of an email send attempt."""
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

class MockEmailProvider:
    """
    Mock email provider for development.
    Logs emails to console and stores in database for verification.
    No actual emails are sent.
    """

    def __init__(self):
        self.sent_emails: list[dict] = []

    def send(self, message: EmailMessage) -> EmailResult:
        """Log the email and store it for verification."""
        import uuid
        message_id = f'mock-email-{uuid.uuid4().hex[:12]}'

        record = {
            'message_id': message_id,
            'to': message.to_email,
            'from': f'{message.from_name} <{message.from_email or settings.DEFAULT_FROM_EMAIL}>',
            'subject': message.subject,
            'body': message.body,
            'html_body': message.html_body,
            'metadata': message.metadata,
            'sent_at': timezone.now().isoformat(),
        }
        self.sent_emails.append(record)

        logger.info(
            'MOCK EMAIL → to=%s subject="%s" id=%s',
            message.to_email, message.subject, message_id,
        )

        return EmailResult(
            success=True,
            provider='mock',
            message_id=message_id,
        )

    def get_sent_emails(self):
        """Return all sent emails (for testing)."""
        return list(self.sent_emails)

    def clear(self):
        """Clear sent emails (for test isolation)."""
        self.sent_emails.clear()


# ─── SMTP PROVIDER ───────────────────────────────────────────────

class SMTPEmailProvider:
    """
    Real SMTP email provider for production.
    Uses Django's EMAIL_HOST settings.
    """

    def send(self, message: EmailMessage) -> EmailResult:
        from_email = message.from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@akademi.id')
        from_name = message.from_name

        msg = MIMEMultipart('alternative')
        msg['From'] = f'{from_name} <{from_email}>'
        msg['To'] = message.to_email
        msg['Subject'] = message.subject
        if message.reply_to:
            msg['Reply-To'] = message.reply_to

        # Plain text body
        msg.attach(MIMEText(message.body, 'plain', 'utf-8'))

        # HTML body
        if message.html_body:
            msg.attach(MIMEText(message.html_body, 'html', 'utf-8'))

        try:
            host = getattr(settings, 'EMAIL_HOST', 'localhost')
            port = getattr(settings, 'EMAIL_PORT', 587)
            use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
            username = getattr(settings, 'EMAIL_HOST_USER', '')
            password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            timeout = getattr(settings, 'EMAIL_TIMEOUT', 10)

            import uuid
            message_id = f'{uuid.uuid4().hex[:12]}@akademi.id'

            with smtplib.SMTP(host, port, timeout=timeout) as server:
                if use_tls:
                    server.starttls()
                if username and password:
                    server.login(username, password)
                server.sendmail(from_email, [message.to_email], msg.as_string())

            logger.info(
                'SMTP EMAIL → to=%s subject="%s" id=%s',
                message.to_email, message.subject, message_id,
            )

            return EmailResult(
                success=True,
                provider='smtp',
                message_id=message_id,
            )

        except Exception as e:
            logger.error(
                'SMTP EMAIL FAILED → to=%s subject="%s" error=%s',
                message.to_email, message.subject, str(e),
            )
            return EmailResult(
                success=False,
                provider='smtp',
                error=str(e),
            )


# ─── PROVIDER FACTORY ────────────────────────────────────────────

# Singleton instances
_mock_provider = None
_smtp_provider = None


def get_email_provider():
    """Get the configured email provider."""
    global _mock_provider, _smtp_provider

    provider_name = getattr(settings, 'EMAIL_PROVIDER', 'mock')

    if provider_name == 'mock':
        if _mock_provider is None:
            _mock_provider = MockEmailProvider()
        return _mock_provider
    elif provider_name == 'smtp':
        if _smtp_provider is None:
            _smtp_provider = SMTPEmailProvider()
        return _smtp_provider
    else:
        logger.warning('Unknown email provider "%s", falling back to mock', provider_name)
        if _mock_provider is None:
            _mock_provider = MockEmailProvider()
        return _mock_provider


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str = '',
    from_email: str = '',
    from_name: str = 'AKADEMI Digital Campus',
    reply_to: str = '',
    metadata: Optional[dict] = None,
) -> EmailResult:
    """Convenience function to send an email."""
    message = EmailMessage(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
        from_email=from_email,
        from_name=from_name,
        reply_to=reply_to,
        metadata=metadata or {},
    )
    return get_email_provider().send(message)

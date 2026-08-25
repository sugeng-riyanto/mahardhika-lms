"""
Notification dispatcher — sends notifications via all configured channels.

Usage:
    from notifications.dispatcher import dispatch_notification

    dispatch_notification(
        recipient=user,
        title='Grade Released',
        message='Your essay has been graded.',
        channels=['in_app', 'email'],
        email_subject='Your grade is ready',
        email_html=render_to_string('notifications/grade_released.html', context),
    )
"""
import logging
from typing import Optional

from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

from notifications.models import Notification, NotificationPreference, NotificationQueue, NotificationDeliveryLog
from notifications.adapters.email import send_email
from notifications.adapters.whatsapp import send_whatsapp

logger = logging.getLogger('notifications.dispatch')

# ─── NOTIFICATION TEMPLATES ──────────────────────────────────────

NOTIFICATION_TEMPLATES = {
    'grade_released': {
        'title': 'Grade Released',
        'message_template': 'Your grade for {course_name} has been released. Score: {score}/{max_score}',
        'email_subject': 'Your grade for {course_name} is ready',
        'whatsapp_template': '🎓 Your grade for {course_name} is ready! Score: {score}/{max_score}. Log in to view details.',
    },
    'assignment_due': {
        'title': 'Assignment Due Soon',
        'message_template': 'Assignment "{assignment_title}" is due in {hours_left} hours.',
        'email_subject': 'Reminder: Assignment due in {hours_left} hours',
        'whatsapp_template': '⏰ Reminder: "{assignment_title}" is due in {hours_left} hours.',
    },
    'submission_received': {
        'title': 'Submission Received',
        'message_template': 'Your submission for "{assignment_title}" has been received.',
        'email_subject': 'Submission confirmed: {assignment_title}',
        'whatsapp_template': '✅ Your submission for "{assignment_title}" has been received.',
    },
    'feedback_available': {
        'title': 'Feedback Available',
        'message_template': 'Your instructor has left feedback on "{assignment_title}".',
        'email_subject': 'New feedback on {assignment_title}',
        'whatsapp_template': '📝 New feedback on "{assignment_title}". Log in to view.',
    },
    'course_enrolled': {
        'title': 'Course Enrollment',
        'message_template': 'You have been enrolled in {course_name}.',
        'email_subject': 'Welcome to {course_name}',
        'whatsapp_template': '🎉 Welcome to {course_name}! Log in to get started.',
    },
    'certificate_issued': {
        'title': 'Certificate Issued',
        'message_template': 'Your certificate for {course_name} has been issued.',
        'email_subject': 'Certificate ready: {course_name}',
        'whatsapp_template': '🏆 Your certificate for {course_name} is ready!',
    },
    'invoice_created': {
        'title': 'New Invoice',
        'message_template': 'A new invoice #{invoice_number} for {amount} has been created.',
        'email_subject': 'New invoice #{invoice_number}',
        'whatsapp_template': '💰 New invoice #{invoice_number} for {amount}.',
    },
    'payment_confirmed': {
        'title': 'Payment Confirmed',
        'message_template': 'Your payment of {amount} for invoice #{invoice_number} has been confirmed.',
        'email_subject': 'Payment confirmed: {invoice_number}',
        'whatsapp_template': '✅ Payment of {amount} confirmed for invoice #{invoice_number}.',
    },
    'canvas_returned': {
        'title': 'Canvas Returned for Revision',
        'message_template': 'Your canvas for "{essay_title}" has been returned for revision.',
        'email_subject': 'Revision needed: {essay_title}',
        'whatsapp_template': '✏️ Your canvas for "{essay_title}" has been returned. Please revise and resubmit.',
    },
    'parent_child_update': {
        'title': 'Child Activity Update',
        'message_template': 'Update about {child_name}: {update_message}',
        'email_subject': 'Update about {child_name}',
        'whatsapp_template': '📋 Update about {child_name}: {update_message}',
    },
}


# ─── DISPATCH FUNCTION ───────────────────────────────────────────

def dispatch_notification(
    recipient,
    title: str,
    message: str,
    channels: Optional[list[str]] = None,
    metadata: Optional[dict] = None,
    email_subject: str = '',
    email_body: str = '',
    email_html: str = '',
    whatsapp_body: str = '',
    template_key: str = '',
    template_vars: Optional[dict] = None,
) -> dict:
    """
    Dispatch a notification across multiple channels.

    Args:
        recipient: User object (must have .email, .full_name attributes)
        title: Notification title (for in_app)
        message: Notification body (for in_app)
        channels: List of channels to send via ('in_app', 'email', 'whatsapp')
        metadata: Extra data to attach to the notification
        email_subject: Override email subject line
        email_body: Override email plain text body
        email_html: Override email HTML body
        whatsapp_body: Override WhatsApp message body
        template_key: Key from NOTIFICATION_TEMPLATES
        template_vars: Variables to fill in templates

    Returns:
        dict with results per channel
    """
    if channels is None:
        channels = ['in_app']

    if metadata is None:
        metadata = {}

    results = {}

    # ── Resolve template if provided ──
    if template_key and template_key in NOTIFICATION_TEMPLATES:
        tpl = NOTIFICATION_TEMPLATES[template_key]
        tv = template_vars or {}
        title = tpl['title']
        message = tpl['message_template'].format(**tv) if tv else tpl['message_template']
        email_subject = email_subject or (tpl.get('email_subject', '').format(**tv) if tv else tpl.get('email_subject', title))
        email_body = email_body or message
        whatsapp_body = whatsapp_body or (tpl.get('whatsapp_template', '').format(**tv) if tv else message)
        metadata['template_key'] = template_key

    # ── In-App notification ──
    if 'in_app' in channels:
        try:
            notif = Notification.objects.create(
                recipient=recipient,
                channel='in_app',
                title=title,
                message=message,
                metadata=metadata,
            )
            results['in_app'] = {'success': True, 'notification_id': str(notif.id)}
            logger.info('In-app notification created for %s: %s', recipient.email, title)
        except Exception as e:
            results['in_app'] = {'success': False, 'error': str(e)}
            logger.error('Failed to create in-app notification: %s', e)

    # ── Get user preferences ──
    try:
        pref = NotificationPreference.objects.get(user=recipient)
    except NotificationPreference.DoesNotExist:
        pref = NotificationPreference.objects.create(
            user=recipient,
            email_enabled=True,
            whatsapp_enabled=False,
            in_app_enabled=True,
        )

    # Check quiet hours for email/whatsapp
    in_quiet_hours = pref.is_quiet_hours()

    # ── Email notification ──
    if 'email' in channels:
        try:
            if not pref.is_channel_enabled('email'):
                results['email'] = {'success': False, 'error': 'Email disabled by user preferences'}
            elif in_quiet_hours:
                # Queue for later instead of sending immediately
                notif = Notification.objects.create(
                    recipient=recipient, channel='email',
                    title=f'[Email] {title}', message=message,
                    metadata={**metadata, 'queued_reason': 'quiet_hours'},
                )
                queue_entry = NotificationQueue.objects.create(
                    notification=notif, channel='email',
                    status='pending', priority='low',
                )
                NotificationDeliveryLog.objects.create(
                    queue_entry=queue_entry, action='queued_quiet_hours',
                    details={'reason': 'quiet_hours'},
                )
                results['email'] = {'success': True, 'queued': True, 'reason': 'quiet_hours'}
            else:
                email_to = getattr(recipient, 'email', None)
                if not email_to:
                    results['email'] = {'success': False, 'error': 'Recipient has no email'}
                else:
                    subject = email_subject or title
                    body = email_body or message

                    if not email_html:
                        email_html = _build_default_html(title, message, recipient)

                    notif = Notification.objects.create(
                        recipient=recipient, channel='email',
                        title=f'[Email] {title}', message=message,
                        metadata=metadata,
                    )
                    queue_entry = NotificationQueue.objects.create(
                        notification=notif, channel='email',
                        status='processing', priority='normal',
                    )

                    result = send_email(
                        to_email=email_to,
                        subject=subject,
                        body=body,
                        html_body=email_html,
                        metadata=metadata,
                    )

                    if result.success:
                        queue_entry.mark_sent(
                            provider_message_id=result.message_id,
                            provider_response=result.to_dict(),
                        )
                    else:
                        queue_entry.mark_failed(result.error)

                    NotificationDeliveryLog.objects.create(
                        queue_entry=queue_entry, action='sent' if result.success else 'failed',
                        details=result.to_dict(),
                    )

                    results['email'] = result.to_dict()
                    logger.info('Email notification sent to %s: %s', email_to, subject)
        except Exception as e:
            results['email'] = {'success': False, 'error': str(e)}
            logger.error('Failed to send email notification: %s', e)

    # ── WhatsApp notification ──
    if 'whatsapp' in channels:
        try:
            if not pref.is_channel_enabled('whatsapp'):
                results['whatsapp'] = {'success': False, 'error': 'WhatsApp disabled by user preferences'}
            elif in_quiet_hours:
                notif = Notification.objects.create(
                    recipient=recipient, channel='whatsapp',
                    title=f'[WhatsApp] {title}', message=message,
                    metadata={**metadata, 'queued_reason': 'quiet_hours'},
                )
                queue_entry = NotificationQueue.objects.create(
                    notification=notif, channel='whatsapp',
                    status='pending', priority='low',
                )
                NotificationDeliveryLog.objects.create(
                    queue_entry=queue_entry, action='queued_quiet_hours',
                    details={'reason': 'quiet_hours'},
                )
                results['whatsapp'] = {'success': True, 'queued': True, 'reason': 'quiet_hours'}
            else:
                phone = getattr(recipient, 'phone_number', None) or metadata.get('phone_number', '')
                if not phone:
                    results['whatsapp'] = {'success': False, 'error': 'Recipient has no phone number'}
                else:
                    body = whatsapp_body or message

                    notif = Notification.objects.create(
                        recipient=recipient, channel='whatsapp',
                        title=f'[WhatsApp] {title}', message=message,
                        metadata=metadata,
                    )
                    queue_entry = NotificationQueue.objects.create(
                        notification=notif, channel='whatsapp',
                        status='processing', priority='normal',
                    )

                    result = send_whatsapp(
                        to_phone=phone,
                        body=body,
                        metadata=metadata,
                    )

                    if result.success:
                        queue_entry.mark_sent(
                            provider_message_id=result.message_id,
                            provider_response=result.to_dict(),
                        )
                    else:
                        queue_entry.mark_failed(result.error)

                    NotificationDeliveryLog.objects.create(
                        queue_entry=queue_entry, action='sent' if result.success else 'failed',
                        details=result.to_dict(),
                    )

                    results['whatsapp'] = result.to_dict()
                    logger.info('WhatsApp notification sent to %s', phone)
        except Exception as e:
            results['whatsapp'] = {'success': False, 'error': str(e)}
            logger.error('Failed to send WhatsApp notification: %s', e)

    return results


def _build_default_html(title: str, message: str, recipient) -> str:
    """Build a simple HTML email from title and message."""
    name = getattr(recipient, 'full_name', '') or getattr(recipient, 'email', 'User')
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%); padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 18px; margin: 0;">🎓 AKADEMI Digital Campus</h1>
      </div>
      <div style="padding: 32px; background: #111827; color: #e5e7eb;">
        <p style="color: #9ca3af; margin: 0 0 8px 0;">Hello {name},</p>
        <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 16px 0;">{title}</h2>
        <p style="margin: 0 0 16px 0; line-height: 1.6;">{message}</p>
        <a href="https://akademi.id/dashboard" style="display: inline-block; padding: 12px 24px; background: #06b6d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View in AKADEMI</a>
      </div>
      <div style="padding: 16px; background: #111827; border-top: 1px solid #374151; text-align: center; color: #6b7280; font-size: 12px;">
        © 2026 AKADEMI Digital Campus
      </div>
    </div>
    """

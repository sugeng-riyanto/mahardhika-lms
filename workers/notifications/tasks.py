"""
Celery tasks for notification delivery — email and WhatsApp.
Uses provider adapters (mock, SMTP, Meta Cloud API).
"""
import logging
from celery import shared_task

logger = logging.getLogger('workers.notifications')


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def send_email_notification(self, notification_id: str):
    """
    Send an email notification using the configured provider.
    
    In production, this would:
    1. Load the notification from the database
    2. Resolve the email provider (mock, SMTP, or production)
    3. Render the template with notification data
    4. Send via the provider
    5. Update delivery status
    """
    try:
        logger.info(f'Sending email notification {notification_id}')
        
        # TODO: Implement actual email sending with adapter
        # from notifications.models import Notification
        # from notifications.adapters import get_email_adapter
        # notification = Notification.objects.get(id=notification_id)
        # adapter = get_email_adapter()
        # adapter.send(
        #     to=notification.recipient_email,
        #     subject=notification.title,
        #     body=notification.message,
        #     template=notification.metadata.get('template'),
        # )
        # notification.status = 'delivered'
        # notification.delivered_at = timezone.now()
        # notification.save(update_fields=['status', 'delivered_at'])
        
        logger.info(f'Email notification {notification_id} sent')
        return {'status': 'delivered', 'notification_id': notification_id}
    except Exception as exc:
        logger.error(f'Email notification {notification_id} failed: {exc}')
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def send_whatsapp_notification(self, notification_id: str):
    """
    Send a WhatsApp notification using the configured provider.
    
    In production, this would:
    1. Load the notification
    2. Check consent — skip if recipient has opted out
    3. Check quiet hours — defer if within quiet period
    4. Send via Meta Cloud API or mock
    5. Record delivery status
    """
    try:
        logger.info(f'Sending WhatsApp notification {notification_id}')
        
        # TODO: Implement actual WhatsApp sending
        # from notifications.models import Notification
        # from notifications.adapters import get_whatsapp_adapter
        # notification = Notification.objects.get(id=notification_id)
        # adapter = get_whatsapp_adapter()
        # adapter.send_template(
        #     to=notification.recipient_phone,
        #     template_name=notification.metadata.get('template', 'default'),
        #     parameters=notification.metadata.get('parameters', []),
        # )
        # notification.status = 'delivered'
        # notification.delivered_at = timezone.now()
        # notification.save(update_fields=['status', 'delivered_at'])
        
        logger.info(f'WhatsApp notification {notification_id} sent')
        return {'status': 'delivered', 'notification_id': notification_id}
    except Exception as exc:
        logger.error(f'WhatsApp notification {notification_id} failed: {exc}')
        raise self.retry(exc=exc)


@shared_task
def send_notification_dispatch(notification_id: str, channels: list[str]):
    """
    Dispatch a notification to multiple channels.
    Called by the notification service after creating a Notification record.
    """
    logger.info(f'Dispatching notification {notification_id} to channels: {channels}')
    
    for channel in channels:
        if channel == 'email':
            send_email_notification.delay(notification_id)
        elif channel == 'whatsapp':
            send_whatsapp_notification.delay(notification_id)
        elif channel == 'in_app':
            # In-app notifications are already stored in the database
            logger.info(f'In-app notification {notification_id} stored')

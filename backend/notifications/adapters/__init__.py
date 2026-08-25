"""
Notification adapters — pluggable channel providers.

Each adapter implements a common interface:
    send(recipient_email, recipient_phone, subject, body, html_body, metadata) -> dict

Providers:
    email:    mock, smtp
    whatsapp: mock, wa_cloud_api (placeholder)
"""

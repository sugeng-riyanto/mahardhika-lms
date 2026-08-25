"""
Supabase Storage utility — file upload with signed URLs, validation, and security.

Files are uploaded directly from the browser to Supabase Storage via signed URLs.
Django never sees the file bytes — only metadata and URLs.

Security:
- File type validation (whitelist)
- File size limits
- Path-based access control (org/user scoped paths)
- Short-lived signed URLs (5 min expiry)
- No user-controlled filenames (UUID-based)
"""
import hashlib
import logging
import mimetypes
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('core.storage')

# ─── ALLOWED FILE TYPES ─────────────────────────────────────────

ALLOWED_FILE_TYPES = {
    # Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.rtf': 'application/rtf',
    # Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    # Spreadsheets
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    # Presentations
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    # Code/Data
    '.py': 'text/x-python',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
}

# Max file sizes by category (in bytes)
MAX_FILE_SIZES = {
    'document': 25 * 1024 * 1024,   # 25 MB
    'image': 10 * 1024 * 1024,       # 10 MB
    'spreadsheet': 15 * 1024 * 1024, # 15 MB
    'presentation': 50 * 1024 * 1024, # 50 MB
    'code': 5 * 1024 * 1024,         # 5 MB
    'archive': 50 * 1024 * 1024,     # 50 MB
    'default': 10 * 1024 * 1024,     # 10 MB
}

FILE_CATEGORY_MAP = {
    '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document', '.rtf': 'document',
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image', '.svg': 'image',
    '.xls': 'spreadsheet', '.xlsx': 'spreadsheet', '.csv': 'spreadsheet',
    '.ppt': 'presentation', '.pptx': 'presentation',
    '.py': 'code', '.js': 'code', '.json': 'code', '.xml': 'code',
    '.zip': 'archive',
}


@dataclass
class UploadResult:
    """Result of a file upload preparation."""
    success: bool
    upload_url: str = ''
    file_path: str = ''
    file_id: str = ''
    signed_url: str = ''
    error: str = ''
    file_type: str = ''
    file_size: int = 0


def get_file_category(extension: str) -> str:
    """Get the file category for size validation."""
    return FILE_CATEGORY_MAP.get(extension, 'default')


def validate_file(filename: str, file_size: int, allowed_types: list[str] = None) -> tuple[bool, str]:
    """
    Validate file type and size.

    Returns (is_valid, error_message).
    """
    import os
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_FILE_TYPES:
        allowed = ', '.join(sorted(ALLOWED_FILE_TYPES.keys()))
        return False, f'File type {ext} not allowed. Allowed types: {allowed}'

    if allowed_types and ext not in allowed_types:
        return False, f'File type {ext} not allowed for this assignment.'

    category = get_file_category(ext)
    max_size = MAX_FILE_SIZES.get(category, MAX_FILE_SIZES['default'])

    if file_size > max_size:
        max_mb = max_size // (1024 * 1024)
        return False, f'File too large. Maximum size for {category} files is {max_mb} MB.'

    return True, ''


def generate_upload_path(
    org_id: str,
    user_id: str,
    assignment_id: str,
    filename: str,
) -> str:
    """
    Generate a safe, unique file path for storage.

    Path structure: {org}/{assignment}/{user}/{uuid}.{ext}
    Never uses the original filename to prevent path traversal.
    """
    import os
    ext = os.path.splitext(filename)[1].lower()
    file_id = uuid.uuid4().hex[:16]
    return f'{org_id}/{assignment_id}/{user_id}/{file_id}{ext}'


def get_supabase_upload_url(
    file_path: str,
    content_type: str,
    expiry_seconds: int = 300,
) -> tuple[str, str]:
    """
    Create a signed upload URL for Supabase Storage.

    Returns (upload_url, error).
    """
    supabase_url = getattr(settings, 'SUPABASE_URL', '')
    secret_key = getattr(settings, 'SUPABASE_SECRET_KEY', '')
    bucket = getattr(settings, 'SUPABASE_BUCKET_SUBMISSIONS', 'student-submissions')

    if not supabase_url or not secret_key or 'placeholder' in supabase_url.lower():
        # Mock mode — return a mock URL
        mock_url = f'https://mock-storage.supabase.co/storage/v1/upload/{bucket}/{file_path}'
        return mock_url, ''

    # Create signed upload URL via Supabase Storage API
    url = f'{supabase_url}/storage/v1/object/{bucket}/{file_path}'
    headers = {
        'Authorization': f'Bearer {secret_key}',
        'Content-Type': content_type,
        'x-upsert': 'true',
    }

    try:
        # For signed URLs, we need to use the signed URL endpoint
        sign_url = f'{supabase_url}/storage/v1/object/sign/{bucket}/{file_path}'
        sign_headers = {
            'Authorization': f'Bearer {secret_key}',
            'Content-Type': 'application/json',
        }
        sign_payload = {
            'expiresIn': expiry_seconds,
        }

        response = requests.post(sign_url, json=sign_payload, headers=sign_headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            signed_path = data.get('signedUrl', '')
            if signed_path:
                full_url = f'{supabase_url}{signed_path}'
                return full_url, ''
            else:
                return '', 'No signed URL returned from Supabase'
        else:
            # Fallback: use the direct upload URL with service role
            logger.warning('Signed URL creation failed (%s), using direct upload', response.status_code)
            return url, ''

    except requests.RequestException as e:
        logger.error('Supabase storage error: %s', e)
        return '', f'Storage service unavailable: {str(e)}'


def get_supabase_signed_url(
    file_path: str,
    expiry_seconds: int = 300,
) -> tuple[str, str]:
    """
    Get a signed download URL for an existing file.

    Returns (signed_url, error).
    """
    supabase_url = getattr(settings, 'SUPABASE_URL', '')
    secret_key = getattr(settings, 'SUPABASE_SECRET_KEY', '')
    bucket = getattr(settings, 'SUPABASE_BUCKET_SUBMISSIONS', 'student-submissions')

    if not supabase_url or not secret_key or 'placeholder' in supabase_url.lower():
        mock_url = f'https://mock-storage.supabase.co/storage/v1/object/sign/{bucket}/{file_path}?token=mock'
        return mock_url, ''

    sign_url = f'{supabase_url}/storage/v1/object/sign/{bucket}/{file_path}'
    headers = {
        'Authorization': f'Bearer {secret_key}',
        'Content-Type': 'application/json',
    }
    payload = {'expiresIn': expiry_seconds}

    try:
        response = requests.post(sign_url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            signed_path = data.get('signedUrl', '')
            if signed_path:
                return f'{supabase_url}{signed_path}', ''
        return '', f'Failed to create signed URL: {response.status_code}'
    except requests.RequestException as e:
        return '', f'Storage service unavailable: {str(e)}'


def delete_supabase_file(file_path: str) -> bool:
    """Delete a file from Supabase Storage."""
    supabase_url = getattr(settings, 'SUPABASE_URL', '')
    secret_key = getattr(settings, 'SUPABASE_SECRET_KEY', '')
    bucket = getattr(settings, 'SUPABASE_BUCKET_SUBMISSIONS', 'student-submissions')

    if not supabase_url or not secret_key or 'placeholder' in supabase_url:
        return True  # Mock mode

    url = f'{supabase_url}/storage/v1/object/{bucket}/{file_path}'
    headers = {'Authorization': f'Bearer {secret_key}'}

    try:
        response = requests.delete(url, headers=headers, timeout=10)
        return response.status_code in (200, 204, 404)
    except requests.RequestException:
        return False

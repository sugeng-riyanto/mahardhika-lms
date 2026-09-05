"""
File upload endpoints for the content library.

Flow:
1. Instructor/admin/owner requests upload URL → gets signed URL + file metadata
2. Browser uploads the file directly to Supabase Storage via the signed URL
3. Client confirms upload → server validates and creates the ContentItem record

Django never touches the file bytes — only metadata and URLs.
"""
import os
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from content.models import ContentItem, ContentStatusLog
from core.storage import (
    validate_file, get_supabase_upload_url,
)
from identity.permissions import _has_any_role, get_user_organisation
from django.conf import settings


class ContentUploadRequestSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1, max_value=100 * 1024 * 1024)  # Max 100MB
    content_type = serializers.CharField(max_length=100, required=False, default='')
    course_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class ContentUploadConfirmSerializer(serializers.Serializer):
    file_path = serializers.CharField(max_length=500)
    original_filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100, required=False, default='')
    title = serializers.CharField(max_length=255, required=False, default='')
    description = serializers.CharField(required=False, default='')
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list)
    course_id = serializers.UUIDField(required=False, allow_null=True, default=None)


def _generate_upload_path(org_id: str, user_id: str, filename: str) -> str:
    """Generate a safe, unique storage path: {org}/{user}/{uuid}.{ext}"""
    import uuid
    ext = os.path.splitext(filename)[1].lower()
    file_id = uuid.uuid4().hex[:16]
    return f'{org_id}/{user_id}/{file_id}{ext}'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_content_upload(request):
    """
    Request a signed upload URL for a content library file.

    Only owners, admins, and instructors may upload content.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_any_role(user, ['owner', 'admin', 'instructor']):
        raise PermissionDenied('Only instructors, admins, or owners can upload content.')

    serializer = ContentUploadRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    filename = serializer.validated_data['filename']
    file_size = serializer.validated_data['file_size']
    content_type = serializer.validated_data.get('content_type', '')

    # Validate file type and size against the global whitelist
    is_valid, error = validate_file(filename, file_size)
    if not is_valid:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    file_path = _generate_upload_path(str(org.id), str(user.id), filename)

    if not content_type:
        content_type = 'application/octet-stream'
        ext = os.path.splitext(filename)[1].lower()
        from core.storage import ALLOWED_FILE_TYPES
        content_type = ALLOWED_FILE_TYPES.get(ext, content_type)

    upload_url, error = get_supabase_upload_url(
        file_path, content_type,
        bucket=settings.SUPABASE_BUCKET_CONTENT,
    )
    if error:
        return Response(
            {'detail': f'Failed to create upload URL: {error}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({
        'upload_url': upload_url,
        'file_path': file_path,
        'file_id': os.path.splitext(os.path.basename(file_path))[0],
        'content_type': content_type,
        'expires_in': 300,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_content_upload(request):
    """
    Confirm a file upload and create the content item record.

    Called after the browser successfully uploads to Supabase Storage.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_any_role(user, ['owner', 'admin', 'instructor']):
        raise PermissionDenied('Only instructors, admins, or owners can upload content.')

    serializer = ContentUploadConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    file_path = serializer.validated_data['file_path']

    # Security: never allow registering a file path outside the user's own org folder
    if not file_path.startswith(f'{org.id}/'):
        raise PermissionDenied('File path does not belong to your organisation.')

    course = None
    course_id = serializer.validated_data.get('course_id')
    if course_id:
        from courses.models import Course
        try:
            course = Course.objects.get(id=course_id, organisation=org)
        except Course.DoesNotExist:
            return Response(
                {'detail': 'Course not found in your organisation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    title = serializer.validated_data.get('title') or serializer.validated_data['original_filename']
    content = ContentItem.objects.create(
        organisation=org,
        course=course,
        title=title,
        description=serializer.validated_data.get('description', ''),
        content_type=_content_type_for(serializer.validated_data.get('content_type', ''), file_path),
        file_url=file_path,
        mime_type=serializer.validated_data.get('content_type', ''),
        file_size=serializer.validated_data['file_size'],
        tags=serializer.validated_data.get('tags', []),
        uploaded_by=user,
        status='draft',
    )
    ContentStatusLog.objects.create(
        content_item=content,
        action='created',
        to_status='draft',
        performed_by=user,
    )

    from content.views import ContentItemSerializer
    return Response(ContentItemSerializer(content).data, status=status.HTTP_201_CREATED)


def _content_type_for(mime_type: str, file_path: str) -> str:
    """Map a MIME type or file extension to a ContentItem.content_type choice."""
    mime_map = {
        'application/pdf': 'document',
        'application/msword': 'document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
        'application/rtf': 'document',
        'text/plain': 'document',
        'text/csv': 'document',
        'application/vnd.ms-excel': 'document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
        'application/vnd.ms-powerpoint': 'document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
        'image/': 'image',
        'video/': 'video',
        'audio/': 'audio',
    }
    if mime_type:
        for prefix, content_type in mime_map.items():
            if mime_type.startswith(prefix):
                return content_type
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'):
        return 'image'
    if ext in ('.mp4', '.webm', '.mov'):
        return 'video'
    if ext in ('.mp3', '.wav', '.ogg', '.m4a'):
        return 'audio'
    if ext == '.zip':
        return 'interactive'
    return 'document'
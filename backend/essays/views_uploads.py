"""
File upload endpoints for essay responses.

Flow:
1. Student requests upload URL → gets signed URL + file metadata
2. Browser uploads the file directly to Supabase Storage via the signed URL
3. Client confirms upload → server validates and attaches the file record
   to the student's essay response

Django never touches the file bytes — only metadata and URLs.
"""
import os
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from essays.models import EssayQuestion, EssayResponse
from core.storage import (
    validate_file, get_supabase_upload_url,
)
from identity.permissions import _has_role, get_user_organisation
from django.conf import settings


class EssayUploadRequestSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1, max_value=100 * 1024 * 1024)  # Max 100MB
    content_type = serializers.CharField(max_length=100, required=False, default='')


class EssayUploadConfirmSerializer(serializers.Serializer):
    response_id = serializers.UUIDField()
    file_path = serializers.CharField(max_length=500)
    original_filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100, required=False, default='')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_essay_upload(request):
    """
    Request a signed upload URL for an essay response file.

    Only students may upload, and only for published questions that
    explicitly allow file uploads.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_role(user, 'student'):
        raise PermissionDenied('Only students can upload essay files.')

    serializer = EssayUploadRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    question_id = serializer.validated_data['question_id']
    filename = serializer.validated_data['filename']
    file_size = serializer.validated_data['file_size']
    content_type = serializer.validated_data.get('content_type', '')

    try:
        question = EssayQuestion.objects.get(id=question_id)
    except EssayQuestion.DoesNotExist:
        return Response(
            {'detail': 'Essay question not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not question.allow_file_upload:
        return Response(
            {'detail': 'This essay does not allow file uploads.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if question.status != 'published':
        return Response(
            {'detail': 'This essay is not open for submission.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Student must be enrolled in the question's course
    if question.course_id:
        from courses.models import Enrolment
        if not Enrolment.objects.filter(
            student=user, course=question.course, status='active',
        ).exists():
            raise PermissionDenied('You are not enrolled in this course.')

    is_valid, error = validate_file(filename, file_size)
    if not is_valid:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    import uuid
    ext = os.path.splitext(filename)[1].lower()
    file_id = uuid.uuid4().hex[:16]
    file_path = f'{org.id}/{question.id}/{user.id}/{file_id}{ext}'

    if not content_type:
        content_type = 'application/octet-stream'
        from core.storage import ALLOWED_FILE_TYPES
        content_type = ALLOWED_FILE_TYPES.get(ext, content_type)

    upload_url, error = get_supabase_upload_url(
        file_path, content_type,
        bucket=settings.SUPABASE_BUCKET_SUBMISSIONS,
    )
    if error:
        return Response(
            {'detail': f'Failed to create upload URL: {error}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({
        'upload_url': upload_url,
        'file_path': file_path,
        'file_id': file_id,
        'content_type': content_type,
        'expires_in': 300,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_essay_upload(request):
    """
    Confirm a file upload and attach it to the student's essay response.

    Called after the browser successfully uploads to Supabase Storage.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_role(user, 'student'):
        raise PermissionDenied('Only students can confirm essay file uploads.')

    serializer = EssayUploadConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    response_id = serializer.validated_data['response_id']
    file_path = serializer.validated_data['file_path']

    try:
        response = EssayResponse.objects.select_related('question').get(
            id=response_id, student=user,
        )
    except EssayResponse.DoesNotExist:
        return Response(
            {'detail': 'Response not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Security: the path must live in the student's own org/question folder
    if not file_path.startswith(f'{org.id}/{response.question_id}/{user.id}/'):
        raise PermissionDenied('File path does not belong to your response.')

    if response.status not in ('draft', 'returned'):
        return Response(
            {'detail': 'Cannot attach files to a submitted response.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attachment = {
        'file_path': file_path,
        'original_filename': serializer.validated_data['original_filename'],
        'file_size': serializer.validated_data['file_size'],
        'content_type': serializer.validated_data.get('content_type', ''),
        'uploaded_at': str(request.data.get('uploaded_at', '')),
    }

    attachments = list(response.attachments) if response.attachments else []
    attachments.append(attachment)
    response.attachments = attachments
    response.save(update_fields=['attachments', 'updated_at'])

    return Response({
        'detail': 'File attached to response.',
        'attachment': attachment,
        'total_files': len(attachments),
    })
"""
File upload endpoints for assignment submissions.

Flow:
1. Client requests upload URL → gets signed URL + file metadata
2. Client uploads file directly to Supabase Storage via signed URL
3. Client confirms upload → server validates and stores file record
4. Client can request signed download URLs for submitted files

Django never touches the file bytes — only metadata and URLs.
"""
import os
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from assignments.models import Assignment, AssignmentSubmission
from core.storage import (
    validate_file, generate_upload_path, get_supabase_upload_url,
    get_supabase_signed_url, delete_supabase_file,
)
from identity.permissions import _has_role, get_user_organisation


class UploadRequestSerializer(serializers.Serializer):
    assignment_id = serializers.UUIDField()
    filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1, max_value=100 * 1024 * 1024)  # Max 100MB
    content_type = serializers.CharField(max_length=100, required=False, default='')


class UploadConfirmSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    file_path = serializers.CharField(max_length=500)
    original_filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100, required=False, default='')
    checksum = serializers.CharField(max_length=64, required=False, default='')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_upload_url(request):
    """
    Request a signed upload URL for a file.

    Validates file type and size, generates a safe path, and returns
    a signed URL for direct browser-to-Supabase upload.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_role(user, 'student'):
        raise PermissionDenied('Only students can upload submission files.')

    serializer = UploadRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    assignment_id = serializer.validated_data['assignment_id']
    filename = serializer.validated_data['filename']
    file_size = serializer.validated_data['file_size']
    content_type = serializer.validated_data.get('content_type', '')

    # Get assignment and validate
    try:
        assignment = Assignment.objects.get(id=assignment_id, organisation=org)
    except Assignment.DoesNotExist:
        return Response(
            {'detail': 'Assignment not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Validate file type against assignment's allowed types
    is_valid, error = validate_file(
        filename, file_size,
        allowed_types=assignment.allowed_file_types if assignment.allowed_file_types else None,
    )
    if not is_valid:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    # Check max file size from assignment
    max_size_bytes = assignment.max_file_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        return Response(
            {'detail': f'File exceeds maximum size of {assignment.max_file_size_mb} MB.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check student is enrolled
    from courses.models import Enrolment
    if not Enrolment.objects.filter(
        student=user, course=assignment.course, status='active',
    ).exists():
        raise PermissionDenied('You are not enrolled in this course.')

    # Generate safe file path
    file_path = generate_upload_path(
        org_id=str(org.id),
        user_id=str(user.id),
        assignment_id=str(assignment.id),
        filename=filename,
    )

    # Detect content type if not provided
    if not content_type:
        content_type = 'application/octet-stream'
        ext = os.path.splitext(filename)[1].lower()
        from core.storage import ALLOWED_FILE_TYPES
        content_type = ALLOWED_FILE_TYPES.get(ext, content_type)

    # Get signed upload URL
    upload_url, error = get_supabase_upload_url(file_path, content_type)
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
def confirm_upload(request):
    """
    Confirm a file upload and attach it to a submission.

    Called after the browser successfully uploads to Supabase Storage.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_role(user, 'student'):
        raise PermissionDenied('Only students can confirm file uploads.')

    serializer = UploadConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    submission_id = serializer.validated_data['submission_id']
    file_path = serializer.validated_data['file_path']
    original_filename = serializer.validated_data['original_filename']
    file_size = serializer.validated_data['file_size']
    content_type = serializer.validated_data.get('content_type', '')
    checksum = serializer.validated_data.get('checksum', '')

    # Get submission and verify ownership
    try:
        submission = AssignmentSubmission.objects.get(
            id=submission_id, student=user, assignment__organisation=org,
        )
    except AssignmentSubmission.DoesNotExist:
        return Response(
            {'detail': 'Submission not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if submission.status != 'draft':
        return Response(
            {'detail': 'Cannot add files to a submitted assignment.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create file record
    file_record = {
        'file_path': file_path,
        'original_filename': original_filename,
        'file_size': file_size,
        'content_type': content_type,
        'checksum': checksum,
        'uploaded_at': str(request.data.get('uploaded_at', '')),
    }

    # Add to submission's file_urls
    file_urls = list(submission.file_urls) if submission.file_urls else []
    file_urls.append(file_record)
    submission.file_urls = file_urls
    submission.save(update_fields=['file_urls', 'updated_at'])

    return Response({
        'detail': 'File attached to submission.',
        'file_record': file_record,
        'total_files': len(file_urls),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_upload(request):
    """
    Remove a file from a submission and delete from storage.
    """
    user = request.user
    org = get_user_organisation(user)

    if not _has_role(user, 'student'):
        raise PermissionDenied('Only students can remove files.')

    submission_id = request.data.get('submission_id')
    file_path = request.data.get('file_path')

    if not submission_id or not file_path:
        return Response(
            {'detail': 'submission_id and file_path are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        submission = AssignmentSubmission.objects.get(
            id=submission_id, student=user, assignment__organisation=org,
        )
    except AssignmentSubmission.DoesNotExist:
        return Response(
            {'detail': 'Submission not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if submission.status != 'draft':
        return Response(
            {'detail': 'Cannot remove files from a submitted assignment.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Remove from file_urls
    file_urls = [f for f in (submission.file_urls or []) if f.get('file_path') != file_path]
    submission.file_urls = file_urls
    submission.save(update_fields=['file_urls', 'updated_at'])

    # Delete from storage
    delete_supabase_file(file_path)

    return Response({
        'detail': 'File removed.',
        'total_files': len(file_urls),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_download_url(request, submission_id, file_path):
    """
    Get a signed download URL for a file.

    Students can only download their own files.
    Instructors can download files for their courses.
    Parents can download files for linked children.
    """
    user = request.user
    org = get_user_organisation(user)

    try:
        submission = AssignmentSubmission.objects.get(
            id=submission_id, assignment__organisation=org,
        )
    except AssignmentSubmission.DoesNotExist:
        return Response(
            {'detail': 'Submission not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Permission check
    is_student_owner = _has_role(user, 'student') and submission.student_id == user.id
    is_instructor = _has_role(user, 'instructor') and submission.assignment.course.instructor_id == user.id
    is_admin = _has_role(user, 'admin') or _has_role(user, 'owner')

    if not (is_student_owner or is_instructor or is_admin):
        # Check parent access
        if _has_role(user, 'parent'):
            from identity.models import ParentChildLink
            if not ParentChildLink.objects.filter(
                parent_user=user,
                student_user=submission.student,
                is_verified=True, is_active=True, consent_given=True,
            ).exists():
                raise PermissionDenied('You do not have access to this file.')
        else:
            raise PermissionDenied('You do not have access to this file.')

    # Verify file_path belongs to this submission
    file_paths = [f.get('file_path', '') for f in (submission.file_urls or [])]
    if file_path not in file_paths:
        return Response(
            {'detail': 'File not found in this submission.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Get signed download URL
    signed_url, error = get_supabase_signed_url(file_path, expiry_seconds=300)
    if error:
        return Response(
            {'detail': f'Failed to create download URL: {error}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({
        'signed_url': signed_url,
        'expires_in': 300,
        'file_path': file_path,
    })

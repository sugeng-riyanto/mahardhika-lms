from django.urls import path, include
from rest_framework.routers import DefaultRouter
from assignments.views import AssignmentSubmissionViewSet
from assignments.views_uploads import (
    request_upload_url, confirm_upload, remove_upload, get_download_url,
)

router = DefaultRouter()
router.register(r'', AssignmentSubmissionViewSet, basename='assignment-submission')

urlpatterns = [
    path('upload/request/', request_upload_url, name='submission-upload-request'),
    path('upload/confirm/', confirm_upload, name='submission-upload-confirm'),
    path('upload/remove/', remove_upload, name='submission-upload-remove'),
    path('<uuid:submission_id>/download/<path:file_path>/', get_download_url, name='submission-download'),
    path('', include(router.urls)),
]

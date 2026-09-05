from django.urls import path, include
from rest_framework.routers import DefaultRouter
from content.views import ContentItemViewSet
from content.views_uploads import (
    request_content_upload, confirm_content_upload,
)

router = DefaultRouter()
router.register(r'', ContentItemViewSet, basename='content-item')

urlpatterns = [
    path('upload/request/', request_content_upload, name='content-upload-request'),
    path('upload/confirm/', confirm_content_upload, name='content-upload-confirm'),
    path('', include(router.urls)),
]
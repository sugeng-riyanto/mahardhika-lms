from django.urls import path, include
from rest_framework.routers import DefaultRouter
from consent.views import (
    ConsentRecordViewSet,
    DataExportRequestViewSet,
    DataDeletionRequestViewSet,
    privacy_notice,
)

router = DefaultRouter()
router.register(r'records', ConsentRecordViewSet, basename='consent-record')
router.register(r'export-requests', DataExportRequestViewSet, basename='data-export-request')
router.register(r'deletion-requests', DataDeletionRequestViewSet, basename='data-deletion-request')

urlpatterns = [
    path('privacy-notice/', privacy_notice, name='privacy-notice'),
    path('', include(router.urls)),
]

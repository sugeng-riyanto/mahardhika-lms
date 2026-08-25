from django.urls import path, include
from rest_framework.routers import DefaultRouter
from audit.views import AuditEventViewSet

router = DefaultRouter()
router.register(r'', AuditEventViewSet, basename='audit-event')

urlpatterns = [
    path('', include(router.urls)),
]

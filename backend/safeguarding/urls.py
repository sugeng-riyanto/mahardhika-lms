from django.urls import path, include
from rest_framework.routers import DefaultRouter
from safeguarding.views import SafeguardingReportViewSet

router = DefaultRouter()
router.register(r'', SafeguardingReportViewSet, basename='safeguarding-report')

urlpatterns = [
    path('', include(router.urls)),
]

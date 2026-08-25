from django.urls import path, include
from rest_framework.routers import DefaultRouter
from sponsorship.views import SponsorshipProgrammeViewSet

router = DefaultRouter()
router.register(r'', SponsorshipProgrammeViewSet, basename='sponsorship-programme')

urlpatterns = [
    path('', include(router.urls)),
]

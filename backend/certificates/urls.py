from django.urls import path, include
from rest_framework.routers import DefaultRouter
from certificates.views import CertificateViewSet, verify_certificate

router = DefaultRouter()
router.register(r'', CertificateViewSet, basename='certificate')

urlpatterns = [
    path('verify/<str:verification_code>/', verify_certificate, name='certificate-verify'),
    path('', include(router.urls)),
]

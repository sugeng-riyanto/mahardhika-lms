from django.urls import path
from identity.views_auth import (
    AuthMeView,
    AuthTokenVerifyView,
    ProfileMeView,
    ChangePasswordView,
    MfaToggleView,
    DeleteAccountView,
)

urlpatterns = [
    path('me/', AuthMeView.as_view(), name='auth-me'),
    path('verify/', AuthTokenVerifyView.as_view(), name='auth-verify'),
    path('profile/', ProfileMeView.as_view(), name='auth-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('mfa/', MfaToggleView.as_view(), name='auth-mfa'),
    path('delete-account/', DeleteAccountView.as_view(), name='auth-delete-account'),
]

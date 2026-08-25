from django.urls import path
from identity.views_auth import AuthMeView, AuthTokenVerifyView

urlpatterns = [
    path('me/', AuthMeView.as_view(), name='auth-me'),
    path('verify/', AuthTokenVerifyView.as_view(), name='auth-verify'),
]

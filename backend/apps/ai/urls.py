from django.urls import path
from .views import MelanyChatView, MelanyHealthCheckView

urlpatterns = [
    path('melany-chat/', MelanyChatView.as_view(), name='melany-chat'),
    path('health/', MelanyHealthCheckView.as_view(), name='ai-health'),
]

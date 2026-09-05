from django.urls import path
from .views import MelanyChatView, MelanyHealthCheckView, ProgramsListView

urlpatterns = [
    path('melany-chat/', MelanyChatView.as_view(), name='melany-chat'),
    path('health/', MelanyHealthCheckView.as_view(), name='ai-health'),
    path('programs/', ProgramsListView.as_view(), name='ai-programs'),
]

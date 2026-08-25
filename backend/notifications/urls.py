from django.urls import path, include
from rest_framework.routers import DefaultRouter
from notifications.views import NotificationViewSet, create_notification_for_user
from notifications.views_preferences import notification_preferences

router = DefaultRouter()
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    path('preferences/', notification_preferences, name='notification-preferences'),
    path('send/', create_notification_for_user, name='notification-send'),
    path('', include(router.urls)),
]

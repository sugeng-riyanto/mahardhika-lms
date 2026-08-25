from django.urls import path, include
from rest_framework.routers import DefaultRouter
from identity.views_users import UserViewSet, ProfileViewSet

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')
router.register(r'profiles', ProfileViewSet, basename='profile')

urlpatterns = [
    path('', include(router.urls)),
]

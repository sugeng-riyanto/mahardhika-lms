from django.urls import path, include
from rest_framework.routers import DefaultRouter
from attempts.views import AttemptViewSet, ResponseViewSet

router = DefaultRouter()
router.register(r'', AttemptViewSet, basename='attempt')

urlpatterns = [
    path('', include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from identity.views_roles import ThirdPartyGrantViewSet

router = DefaultRouter()
router.register(r'', ThirdPartyGrantViewSet, basename='third-party-grant')

urlpatterns = [
    path('', include(router.urls)),
]

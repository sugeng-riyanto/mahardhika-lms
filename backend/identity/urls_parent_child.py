from django.urls import path, include
from rest_framework.routers import DefaultRouter
from identity.views_roles import ParentChildLinkViewSet

router = DefaultRouter()
router.register(r'', ParentChildLinkViewSet, basename='parent-child-link')

urlpatterns = [
    path('', include(router.urls)),
]

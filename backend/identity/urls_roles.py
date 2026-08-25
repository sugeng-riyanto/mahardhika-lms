from django.urls import path, include
from rest_framework.routers import DefaultRouter
from identity.views_roles import (
    RoleAssignmentViewSet, RoleListView,
)

# Role assignments at root
router = DefaultRouter()
router.register(r'', RoleAssignmentViewSet, basename='role-assignment')

urlpatterns = [
    path('', include(router.urls)),
]

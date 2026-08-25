from django.urls import path, include
from rest_framework.routers import DefaultRouter
from identity.views_roles import RoleListView

router = DefaultRouter()
router.register(r'', RoleListView, basename='role')

urlpatterns = [
    path('', include(router.urls)),
]

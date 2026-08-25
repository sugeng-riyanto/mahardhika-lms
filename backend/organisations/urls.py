from django.urls import path, include
from rest_framework.routers import DefaultRouter
from organisations.views import OrganisationViewSet

router = DefaultRouter()
router.register(r'', OrganisationViewSet, basename='organisation')

urlpatterns = [
    path('', include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from courses.views_programmes import ProgrammeViewSet

router = DefaultRouter()
router.register(r'', ProgrammeViewSet, basename='programme')

urlpatterns = [
    path('', include(router.urls)),
]

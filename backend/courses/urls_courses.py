from django.urls import path, include
from rest_framework.routers import DefaultRouter
from courses.views_courses import CourseViewSet

router = DefaultRouter()
router.register(r'', CourseViewSet, basename='course')

urlpatterns = [
    path('', include(router.urls)),
]

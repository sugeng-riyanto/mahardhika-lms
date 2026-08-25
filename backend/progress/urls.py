from django.urls import path, include
from rest_framework.routers import DefaultRouter
from progress.views import CompletionRecordViewSet, CourseProgressViewSet

router = DefaultRouter()
router.register(r'completions', CompletionRecordViewSet, basename='completion-record')
router.register(r'courses', CourseProgressViewSet, basename='course-progress')

urlpatterns = [
    path('', include(router.urls)),
]

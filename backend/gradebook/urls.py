from django.urls import path, include
from rest_framework.routers import DefaultRouter
from gradebook.views import GradeViewSet, GradeEventViewSet

router = DefaultRouter()
router.register(r'', GradeViewSet, basename='grade')
router.register(r'events', GradeEventViewSet, basename='grade-event')

urlpatterns = [
    path('', include(router.urls)),
]

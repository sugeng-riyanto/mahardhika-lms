from django.urls import path, include
from rest_framework.routers import DefaultRouter
from attendance.views import LessonScheduleViewSet, AttendanceRecordViewSet

router = DefaultRouter()
router.register(r'schedules', LessonScheduleViewSet, basename='lesson-schedule')
router.register(r'records', AttendanceRecordViewSet, basename='attendance-record')

urlpatterns = [
    path('', include(router.urls)),
]

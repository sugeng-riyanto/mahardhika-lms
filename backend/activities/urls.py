from django.urls import path, include
from rest_framework.routers import DefaultRouter
from activities.views import ActivityDefinitionViewSet, ActivityQuestionViewSet

router = DefaultRouter()
router.register(r'definitions', ActivityDefinitionViewSet, basename='activity-definition')
router.register(r'questions', ActivityQuestionViewSet, basename='activity-question')

urlpatterns = [
    path('', include(router.urls)),
]

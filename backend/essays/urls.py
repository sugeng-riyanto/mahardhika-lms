from django.urls import path, include
from rest_framework.routers import DefaultRouter
from essays.views import (
    EssayQuestionViewSet, EssayResponseViewSet,
    RubricCriterionViewSet, RubricScoreViewSet,
    InlineFeedbackViewSet,
)

router = DefaultRouter()
router.register(r'questions', EssayQuestionViewSet, basename='essay-question')
router.register(r'responses', EssayResponseViewSet, basename='essay-response')
router.register(r'criteria', RubricCriterionViewSet, basename='rubric-criterion')
router.register(r'scores', RubricScoreViewSet, basename='rubric-score')
router.register(r'feedback', InlineFeedbackViewSet, basename='inline-feedback')

urlpatterns = [
    path('', include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from essays.views import (
    EssayQuestionViewSet, EssayResponseViewSet,
    RubricCriterionViewSet, RubricScoreViewSet,
    InlineFeedbackViewSet,
)
from essays.views_uploads import (
    request_essay_upload, confirm_essay_upload,
)

router = DefaultRouter()
router.register(r'questions', EssayQuestionViewSet, basename='essay-question')
router.register(r'responses', EssayResponseViewSet, basename='essay-response')
router.register(r'criteria', RubricCriterionViewSet, basename='rubric-criterion')
router.register(r'scores', RubricScoreViewSet, basename='rubric-score')
router.register(r'feedback', InlineFeedbackViewSet, basename='inline-feedback')

urlpatterns = [
    path('upload/request/', request_essay_upload, name='essay-upload-request'),
    path('upload/confirm/', confirm_essay_upload, name='essay-upload-confirm'),
    path('', include(router.urls)),
]

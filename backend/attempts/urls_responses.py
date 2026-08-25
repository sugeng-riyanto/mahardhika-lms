from rest_framework.routers import DefaultRouter
from attempts.views import ResponseViewSet

router = DefaultRouter()
router.register(r'', ResponseViewSet, basename='attempt-response')

urlpatterns = router.urls

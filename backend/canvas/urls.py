from django.urls import path, include
from rest_framework.routers import DefaultRouter
from canvas.views import CanvasDocumentViewSet

router = DefaultRouter()
router.register(r'', CanvasDocumentViewSet, basename='canvas-document')

urlpatterns = [
    path('', include(router.urls)),
]

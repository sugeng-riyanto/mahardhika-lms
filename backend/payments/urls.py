from django.urls import path, include
from rest_framework.routers import DefaultRouter
from payments.views import PaymentIntentViewSet, PaymentRefundViewSet, midtrans_webhook

router = DefaultRouter()
router.register(r'intents', PaymentIntentViewSet, basename='payment-intent')
router.register(r'refunds', PaymentRefundViewSet, basename='payment-refund')

urlpatterns = [
    path('webhook/midtrans/', midtrans_webhook, name='midtrans-webhook'),
    path('', include(router.urls)),
]

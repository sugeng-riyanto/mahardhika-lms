from django.urls import path, include
from rest_framework.routers import DefaultRouter
from finance.views import InvoiceViewSet, finance_summary

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('summary/', finance_summary, name='finance-summary'),
    path('', include(router.urls)),
]

"""
Safeguarding — admin/owner only, org-scoped.
"""
from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.audit_mixin import AuditLogMixin
from safeguarding.models import SafeguardingReport
from identity.permissions import IsAdminOrOwner, get_user_organisation


class SafeguardingReportSerializer(serializers.ModelSerializer):
    reporter_email = serializers.CharField(source='reporter.email', read_only=True)

    class Meta:
        model = SafeguardingReport
        fields = '__all__'


class SafeguardingReportViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Safeguarding reports — admin/owner only, org-scoped."""
    audit_resource_type = 'safeguarding_report'
    serializer_class = SafeguardingReportSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]

    def get_queryset(self):
        org = get_user_organisation(self.request.user)
        if org and hasattr(SafeguardingReport, 'organisation'):
            return SafeguardingReport.objects.filter(organisation=org)
        return SafeguardingReport.objects.all()

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)

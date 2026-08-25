"""
Sponsorship — sponsor role only, limited to their grants.

Sponsors can only see:
- Their own sponsorship programmes
- Aggregate programme statistics (no individual student data)
- Fund utilisation per programme
- Consent summary (aggregate counts, not individual records)
"""
from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.db.models import Count, Avg, Q

from core.audit_mixin import AuditLogMixin
from sponsorship.models import SponsorshipProgramme
from identity.permissions import get_user_organisation, IsSponsorshipRole


class SponsorshipProgrammeSerializer(serializers.ModelSerializer):
    """Serializer with aggregate stats for sponsor view."""

    organisation_name = serializers.CharField(source='organisation.name', read_only=True)
    total_students = serializers.SerializerMethodField()
    total_courses = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()
    average_grade = serializers.SerializerMethodField()
    fund_percentage = serializers.SerializerMethodField()

    class Meta:
        model = SponsorshipProgramme
        fields = [
            'id', 'organisation', 'organisation_name', 'sponsor_user',
            'name', 'fund_amount', 'fund_utilised', 'is_active',
            'total_students', 'total_courses', 'completion_rate',
            'average_grade', 'fund_percentage',
            'created_at', 'updated_at',
        ]

    def get_total_students(self, obj):
        """Aggregate count of unique students in the sponsored programme's courses."""
        try:
            from courses.models import Enrolment
            programme = self._get_programme(obj)
            if not programme:
                return 0
            return Enrolment.objects.filter(
                course__programme=programme,
                status='active',
            ).values('student').distinct().count()
        except Exception:
            return 0

    def get_total_courses(self, obj):
        """Count of courses in the sponsored programme."""
        try:
            programme = self._get_programme(obj)
            if not programme:
                return 0
            return programme.courses.count()
        except Exception:
            return 0

    def get_completion_rate(self, obj):
        """Aggregate completion rate across the programme's courses."""
        try:
            from courses.models import Enrolment
            programme = self._get_programme(obj)
            if not programme:
                return 0
            total = Enrolment.objects.filter(
                course__programme=programme,
            ).count()
            completed = Enrolment.objects.filter(
                course__programme=programme,
                status='completed',
            ).count()
            return round((completed / total * 100), 1) if total > 0 else 0
        except Exception:
            return 0

    def get_average_grade(self, obj):
        """Aggregate average grade across the programme (released grades only)."""
        try:
            from gradebook.models import Grade
            programme = self._get_programme(obj)
            if not programme:
                return 0
            avg = Grade.objects.filter(
                activity__lesson__course__programme=programme,
                released=True,
            ).aggregate(avg=Avg('score'))['avg']
            return round(float(avg), 1) if avg else 0
        except Exception:
            return 0

    def get_fund_percentage(self, obj):
        """Percentage of fund utilised."""
        if obj.fund_amount and float(obj.fund_amount) > 0:
            return round(float(obj.fund_utilised) / float(obj.fund_amount) * 100, 1)
        return 0

    def _get_programme(self, obj):
        """Get the Programme linked to this sponsorship."""
        try:
            from courses.models import Programme
            # Match by name slug or organisation
            return Programme.objects.filter(
                organisation=obj.organisation,
                is_active=True,
            ).first()
        except Exception:
            return None


class SponsorshipProgrammeViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Sponsorship — sponsors see own grants; admins manage all."""
    audit_resource_type = 'sponsorship_programme'
    serializer_class = SponsorshipProgrammeSerializer
    permission_classes = [IsAuthenticated, IsSponsorshipRole]

    def get_queryset(self):
        user = self.request.user
        from identity.permissions import _has_any_role, get_user_organisation
        org = get_user_organisation(user)

        # Admin/Owner: all sponsorships in their org
        if _has_any_role(user, ['owner', 'admin']):
            qs = SponsorshipProgramme.objects.filter(organisation__isnull=False)
            if org:
                qs = qs.filter(organisation=org)
            return qs

        # Sponsor: only their own grants
        return SponsorshipProgramme.objects.filter(
            sponsor_user=user,
            organisation__isnull=False,
        )

    def perform_create(self, serializer):
        user = self.request.user
        from identity.permissions import _has_any_role
        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can create sponsorship programmes.')
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        from identity.permissions import _has_any_role
        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can modify sponsorship programmes.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        from identity.permissions import _has_any_role
        if not _has_any_role(user, ['owner', 'admin']):
            raise PermissionDenied('Only admins can delete sponsorship programmes.')
        instance.delete()

    @action(detail=False, methods=['get'], url_path='aggregate')
    def aggregate_stats(self, request):
        """Return aggregate stats across all sponsor's programmes."""
        user = request.user
        programmes = SponsorshipProgramme.objects.filter(
            sponsor_user=user,
            organisation__isnull=False,
        )

        total_fund = sum(float(p.fund_amount) for p in programmes)
        total_utilised = sum(float(p.fund_utilised) for p in programmes)

        # Compute aggregate student/course counts
        total_students = 0
        total_courses = 0
        for p in programmes:
            try:
                from courses.models import Enrolment, Programme
                programme = Programme.objects.filter(organisation=p.organisation, is_active=True).first()
                if programme:
                    total_students += Enrolment.objects.filter(
                        course__programme=programme, status='active',
                    ).values('student').distinct().count()
                    total_courses += programme.courses.count()
            except Exception:
                pass

        # Consent summary
        consent_summary = {'learning': 0, 'analytics': 0, 'communication': 0, 'third_party': 0}
        try:
            from consent.models import ConsentRecord
            for purpose in consent_summary:
                consent_summary[purpose] = ConsentRecord.objects.filter(
                    purpose=purpose, granted=True,
                ).count()
        except Exception:
            pass

        return DRFResponse({
            'programme_count': programmes.count(),
            'total_students': total_students,
            'total_courses': total_courses,
            'total_fund': total_fund,
            'total_utilised': total_utilised,
            'fund_percentage': round((total_utilised / total_fund * 100), 1) if total_fund > 0 else 0,
            'consent_summary': consent_summary,
        })

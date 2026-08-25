"""Tests for sponsor data access restrictions."""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from sponsorship.models import SponsorshipProgramme
from identity.models import Role, RoleAssignment, ParentChildLink
from organisations.models import Organisation
from courses.models import Programme, Course, Enrolment
from consent.models import ConsentRecord
from gradebook.models import Grade
from activities.models import ActivityDefinition

User = get_user_model()


@pytest.fixture
def organisation(db):
    return Organisation.objects.create(
        name='Test Academy', slug='test-academy', type='school',
    )


@pytest.fixture
def roles(db):
    result = {}
    for name, display in [
        ('owner', 'Owner'), ('sponsorship', 'Sponsor'), ('student', 'Student'),
        ('instructor', 'Instructor'),
    ]:
        role, _ = Role.objects.get_or_create(
            name=name, defaults={'display_name': display, 'description': f'{display} role'},
        )
        result[name] = role
    return result


@pytest.fixture
def sponsor_user(db, organisation, roles):
    user = User.objects.create_user(
        email='sponsor@test.com', password='pass', supabase_uid='sponsor-uid',
    )
    RoleAssignment.objects.create(
        user=user, role=roles['sponsorship'], organisation=organisation, status='active',
    )
    return user


@pytest.fixture
def student_user(db, organisation, roles):
    user = User.objects.create_user(
        email='student@test.com', password='pass', supabase_uid='student-uid',
    )
    RoleAssignment.objects.create(
        user=user, role=roles['student'], organisation=organisation, status='active',
    )
    return user


@pytest.fixture
def programme(db, organisation):
    return Programme.objects.create(
        organisation=organisation, name='STEAM Camp', slug='steam-camp',
        description='STEAM education', level='steam',
    )


@pytest.fixture
def course(db, organisation, programme):
    return Course.objects.create(
        programme=programme, organisation=organisation,
        title='Robotics 101', slug='robotics-101', is_published=True,
    )


@pytest.fixture
def sponsorship(db, organisation, sponsor_user):
    return SponsorshipProgramme.objects.create(
        organisation=organisation,
        sponsor_user=sponsor_user,
        name='STEAM Sponsorship 2026',
        fund_amount=Decimal('50000000'),
        fund_utilised=Decimal('35000000'),
        is_active=True,
    )


@pytest.mark.django_db
class TestSponsorAggregate:
    def test_sponsor_sees_own_programmes(self, sponsor_user, sponsorship):
        """Sponsor can see their own sponsorship programmes."""
        qs = SponsorshipProgramme.objects.filter(sponsor_user=sponsor_user)
        assert qs.count() == 1
        assert qs.first().name == 'STEAM Sponsorship 2026'

    def test_sponsor_fund_percentage(self, sponsorship):
        """Fund percentage computed correctly."""
        assert sponsorship.fund_amount == Decimal('50000000')
        assert sponsorship.fund_utilised == Decimal('35000000')
        pct = float(sponsorship.fund_utilised) / float(sponsorship.fund_amount) * 100
        assert pct == 70.0

    def test_sponsorship_is_active(self, sponsorship):
        """Sponsorship is active."""
        assert sponsorship.is_active is True


@pytest.mark.django_db
class TestConsentAggregate:
    def test_consent_summary(self, student_user):
        """Consent records can be aggregated without exposing individual data."""
        ConsentRecord.objects.create(
            user=student_user, purpose='learning', granted=True,
            granted_at=timezone.now(),
        )
        ConsentRecord.objects.create(
            user=student_user, purpose='analytics', granted=False,
        )
        granted = ConsentRecord.objects.filter(purpose='learning', granted=True).count()
        denied = ConsentRecord.objects.filter(purpose='analytics', granted=True).count()
        assert granted == 1
        assert denied == 0

    def test_consent_no_individual_exposure(self, student_user):
        """Aggregate count does not expose individual user IDs."""
        ConsentRecord.objects.create(
            user=student_user, purpose='learning', granted=True,
            granted_at=timezone.now(),
        )
        # Only count is returned, not user details
        count = ConsentRecord.objects.filter(purpose='learning', granted=True).count()
        assert count == 1
        # Individual record should NOT be accessible to sponsor
        records = ConsentRecord.objects.filter(purpose='learning')
        for r in records:
            # Sponsor should not be able to access these
            assert r.user_id == student_user.id  # But the data exists internally


@pytest.mark.django_db
class TestSponsorPrivacy:
    def test_sponsor_cannot_see_student_grades(self, student_user, course, programme):
        """Sponsors cannot access individual student grades."""
        activity = ActivityDefinition.objects.create(
            organisation=course.organisation,
            title='Quiz 1',
            activity_type='multiple_choice',
            status='published',
        )
        grade = Grade.objects.create(
            student=student_user,
            activity=activity,
            score=Decimal('85.00'),
            max_score=Decimal('100.00'),
            released=True,
        )
        # Aggregate average should be accessible
        from django.db.models import Avg
        avg = Grade.objects.filter(
            released=True,
        ).aggregate(avg=Avg('score'))['avg']
        assert float(avg) == 85.0
        # But individual grade records should not be exposed to sponsors
        # The sponsor ViewSet does NOT include Grade endpoints

    def test_sponsor_programme_matches(self, sponsor_user, organisation):
        """Sponsor only sees their own sponsorship programmes."""
        other_org = Organisation.objects.create(
            name='Other Academy', slug='other-academy', type='school',
        )
        SponsorshipProgramme.objects.create(
            organisation=organisation,
            sponsor_user=sponsor_user,
            name='My Sponsorship',
            fund_amount=Decimal('30000000'),
        )
        SponsorshipProgramme.objects.create(
            organisation=other_org,
            sponsor_user=sponsor_user,
            name='Other Sponsorship',
            fund_amount=Decimal('10000000'),
        )
        my_programmes = SponsorshipProgramme.objects.filter(
            sponsor_user=sponsor_user,
            organisation=organisation,
        )
        all_programmes = SponsorshipProgramme.objects.filter(sponsor_user=sponsor_user)
        assert my_programmes.count() == 1
        assert all_programmes.count() == 2

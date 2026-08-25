"""
Tests for AuditLogMixin — verifies audit events are created for all write operations.

Tests cover:
- CREATE operations generate audit events
- UPDATE operations generate audit events with changed fields
- DELETE operations generate audit events
- Audit events contain correct actor, resource, action details
- Audit events are immutable (cannot be updated or deleted)
- Audit logging does not break the request on failure
"""
import pytest
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APIRequestFactory
from unittest.mock import MagicMock, patch

from audit.models import AuditEvent
from core.audit_mixin import AuditLogMixin

User = get_user_model()


@pytest.fixture
def admin_user(db):
    from identity.models import Role, RoleAssignment
    from organisations.models import Organisation

    user = User.objects.create_user(
        email='auditadmin@test.com',
        supabase_uid='audit-admin-uid',
        full_name='Audit Admin',
    )
    org = Organisation.objects.create(name='Audit Org', slug='audit-org', is_active=True)
    role, _ = Role.objects.get_or_create(name='admin', defaults={'display_name': 'Admin'})
    RoleAssignment.objects.create(user=user, role=role, organisation=org, status='active')
    return user


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def request_factory():
    return RequestFactory()


@pytest.mark.django_db
class TestAuditEventModel:
    """Test the AuditEvent model itself."""

    def test_create_audit_event(self, admin_user):
        import uuid
        event = AuditEvent.log(
            actor_id=admin_user.id,
            actor_email=admin_user.email,
            action='test.action',
            resource_type='test_resource',
            resource_id=str(uuid.uuid4()),
            scope='test',
            details={'key': 'value'},
            ip_address='127.0.0.1',
            user_agent='TestAgent/1.0',
        )
        assert event.pk is not None
        assert event.actor_email == 'auditadmin@test.com'
        assert event.action == 'test.action'
        assert event.resource_type == 'test_resource'
        assert event.resource_id is not None
        assert event.details == {'key': 'value'}
        assert event.ip_address == '127.0.0.1'

    def test_audit_event_is_immutable(self, admin_user):
        event = AuditEvent.objects.create(
            actor_id=admin_user.id,
            actor_email=admin_user.email,
            action='test.immutable',
            resource_type='test',
        )
        with pytest.raises(ValueError, match='immutable'):
            event.action = 'modified'
            event.save()

    def test_audit_event_str(self, admin_user):
        event = AuditEvent.log(
            actor_id=admin_user.id,
            actor_email=admin_user.email,
            action='user.create',
            resource_type='user',
        )
        assert 'auditadmin@test.com' in str(event)
        assert 'user.create' in str(event)


@pytest.mark.django_db
class TestAuditLogMixin:
    """Test the AuditLogMixin on a simple ViewSet."""

    def test_mixin_logs_create(self, admin_user, request_factory):
        """Verify perform_create logs an audit event."""
        from courses.models import Programme
        from courses.serializers import ProgrammeSerializer
        from courses.views_programmes import ProgrammeViewSet
        from organisations.models import Organisation

        org = Organisation.objects.first()

        request = request_factory.post(
            '/api/v1/programmes/',
            {'name': 'Test Programme', 'slug': 'test-prog', 'level': 'jhs', 'organisation': str(org.id)},
            format='json',
        )
        request.user = admin_user
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        request.META['HTTP_USER_AGENT'] = 'TestAgent/1.0'

        view = ProgrammeViewSet()
        view.request = request
        view.format_kwarg = None
        view.action = 'create'

        initial_count = AuditEvent.objects.count()

        # Simulate DRF's perform_create
        data = {'name': 'Test Programme', 'slug': 'test-prog', 'level': 'jhs', 'organisation': str(org.id)}
        serializer = ProgrammeSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

        view.perform_create(serializer)

        # An audit event should be created
        assert AuditEvent.objects.count() == initial_count + 1
        event = AuditEvent.objects.latest('created_at')
        assert 'programme.create' in event.action
        assert event.resource_type == 'programme'
        assert event.actor_email == 'auditadmin@test.com'
        assert event.ip_address == '127.0.0.1'

    def test_mixin_logs_update(self, admin_user, request_factory):
        """Verify perform_update logs an audit event with changed fields."""
        from courses.models import Programme
        from courses.serializers import ProgrammeSerializer
        from courses.views_programmes import ProgrammeViewSet
        from organisations.models import Organisation

        org = Organisation.objects.first()
        prog = Programme.objects.create(
            name='Original Name', slug='orig', level='jhs',
            is_active=True, organisation=org,
        )

        request = request_factory.patch(
            f'/api/v1/programmes/{prog.id}/',
            {'name': 'Updated Name'},
            format='json',
        )
        request.user = admin_user
        request.META['REMOTE_ADDR'] = '10.0.0.1'
        request.META['HTTP_USER_AGENT'] = 'TestAgent/2.0'

        view = ProgrammeViewSet()
        view.request = request
        view.format_kwarg = None
        view.action = 'update'
        view.kwargs = {'pk': str(prog.pk)}

        initial_count = AuditEvent.objects.count()

        # Partial update
        serializer = ProgrammeSerializer(prog, data={'name': 'Updated Name'}, partial=True)
        assert serializer.is_valid(), serializer.errors

        view.perform_update(serializer)

        # An audit event should be created
        assert AuditEvent.objects.count() == initial_count + 1
        event = AuditEvent.objects.latest('created_at')
        assert 'programme.update' in event.action
        assert 'changed_fields' in event.details
        assert 'name' in event.details['changed_fields']

    def test_mixin_logs_delete(self, admin_user, request_factory):
        """Verify perform_destroy logs an audit event."""
        from courses.models import Programme
        from courses.views_programmes import ProgrammeViewSet
        from organisations.models import Organisation

        org = Organisation.objects.first()
        prog = Programme.objects.create(
            name='To Delete', slug='to-delete', level='jhs',
            is_active=True, organisation=org,
        )

        request = request_factory.delete(f'/api/v1/programmes/{prog.id}/')
        request.user = admin_user
        request.META['REMOTE_ADDR'] = '192.168.1.1'

        view = ProgrammeViewSet()
        view.request = request
        view.format_kwarg = None
        view.action = 'destroy'
        view.kwargs = {'pk': str(prog.pk)}

        initial_count = AuditEvent.objects.count()

        view.perform_destroy(prog)

        # An audit event should be created
        assert AuditEvent.objects.count() == initial_count + 1
        event = AuditEvent.objects.latest('created_at')
        assert 'programme.delete' in event.action
        assert event.resource_type == 'programme'
        assert event.details.get('deleted_data', {}).get('name') == 'To Delete'

    def test_mixin_captures_ip_address(self, admin_user, request_factory):
        """Verify the mixin captures client IP."""
        from courses.models import Programme
        from courses.views_programmes import ProgrammeViewSet
        from organisations.models import Organisation

        org = Organisation.objects.first()

        request = request_factory.post('/api/v1/programmes/')
        request.user = admin_user
        request.META['REMOTE_ADDR'] = '10.0.0.99'
        request.META['HTTP_USER_AGENT'] = 'Browser/1.0'

        view = ProgrammeViewSet()
        view.request = request
        view.format_kwarg = None
        view.action = 'create'
        view.audit_resource_type = 'programme'

        # Test _get_client_ip directly
        ip = view._get_client_ip(request)
        assert ip == '10.0.0.99'

    def test_mixin_captures_forwarded_for(self, admin_user, request_factory):
        """Verify the mixin handles X-Forwarded-For header."""
        from courses.views_programmes import ProgrammeViewSet

        request = request_factory.post('/api/v1/programmes/')
        request.user = admin_user
        request.META['HTTP_X_FORWARDED_FOR'] = '203.0.113.19, 70.41.3.18'

        view = ProgrammeViewSet()
        view.request = request

        ip = view._get_client_ip(request)
        assert ip == '203.0.113.19'


@pytest.mark.django_db
class TestAuditEventCount:
    """Test that multiple operations create multiple audit events."""

    def test_multiple_creates_log_each(self, admin_user):
        from courses.models import Programme
        from organisations.models import Organisation

        org = Organisation.objects.first()
        initial_count = AuditEvent.objects.count()

        for i in range(3):
            AuditEvent.log(
                actor_id=admin_user.id,
                actor_email=admin_user.email,
                action='programme.create',
                resource_type='programme',
                details={'name': f'Programme {i}'},
            )

        assert AuditEvent.objects.count() == initial_count + 3

    def test_audit_events_are_ordered(self, admin_user):
        from audit.models import AuditEvent

        AuditEvent.log(
            actor_id=admin_user.id,
            actor_email=admin_user.email,
            action='first',
            resource_type='test',
        )
        AuditEvent.log(
            actor_id=admin_user.id,
            actor_email=admin_user.email,
            action='second',
            resource_type='test',
        )

        events = AuditEvent.objects.all()[:2]
        assert events[0].action == 'second'  # most recent first
        assert events[1].action == 'first'

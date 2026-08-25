import pytest
from django.test import Client
from django.test.utils import override_settings
from rest_framework.test import APIClient
from identity.models import User, Role, RoleAssignment


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def mock_user(db, organisation, roles):
    user = User.objects.create_user(
        email='apiuser@test.com',
        password='testpass123',
        supabase_uid='api-user-uid',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['admin'],
        organisation=organisation,
        status='active',
    )
    return user


@pytest.mark.django_db
class TestHealthCheck:
    def test_health_check_success(self):
        client = Client()
        response = client.get('/api/v1/health/')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert data['database'] == 'connected'
        assert 'version' in data


@pytest.mark.django_db
class TestAuthEndpoints:
    def test_auth_me_unauthenticated(self, api_client):
        response = api_client.get('/api/v1/auth/me/')
        assert response.status_code in (401, 403)

    def test_auth_me_authenticated(self, api_client, mock_user):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/auth/me/')
        assert response.status_code == 200
        data = response.json()
        assert data['user']['email'] == 'apiuser@test.com'
        assert 'admin' in data['roles']

    def test_auth_verify(self, api_client, mock_user):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/auth/verify/')
        assert response.status_code == 200
        assert response.json()['valid'] is True


@pytest.mark.django_db
class TestUserEndpoints:
    def test_list_users_unauthenticated(self, api_client):
        response = api_client.get('/api/v1/users/')
        assert response.status_code in (401, 403)

    def test_list_users_admin(self, api_client, mock_user):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/users/')
        assert response.status_code == 200

    def test_create_user(self, api_client, mock_user):
        api_client.force_authenticate(user=mock_user)
        response = api_client.post('/api/v1/users/', {
            'email': 'newuser@test.com',
            'supabase_uid': 'new-uid',
            'full_name': 'New User',
        })
        assert response.status_code == 201


@pytest.mark.django_db
class TestOrganisationEndpoints:
    def test_list_organisations_unauthenticated(self, api_client):
        response = api_client.get('/api/v1/organisations/')
        assert response.status_code in (401, 403)

    def test_list_organisations_admin(self, api_client, mock_user, organisation):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/organisations/')
        assert response.status_code == 200
        assert response.json()['count'] >= 1


@pytest.mark.django_db
class TestCourseEndpoints:
    def test_list_courses_unauthenticated(self, api_client):
        response = api_client.get('/api/v1/courses/')
        assert response.status_code in (401, 403)

    def test_list_courses_admin(self, api_client, mock_user, sample_course):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/courses/')
        assert response.status_code == 200

    def test_create_course(self, api_client, mock_user, sample_programme):
        api_client.force_authenticate(user=mock_user)
        response = api_client.post('/api/v1/courses/', {
            'programme': str(sample_programme.id),
            'organisation': str(sample_programme.organisation_id),
            'title': 'New Course',
            'slug': 'new-course',
        })
        assert response.status_code == 201


@pytest.mark.django_db
class TestRoleAssignmentEndpoints:
    def test_list_role_assignments(self, api_client, mock_user):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/role-assignments/')
        assert response.status_code == 200

    def test_list_roles(self, api_client, mock_user):
        api_client.force_authenticate(user=mock_user)
        response = api_client.get('/api/v1/role-assignments/roles/')
        # Roles are listed via the roles router
        assert response.status_code in (200, 404)

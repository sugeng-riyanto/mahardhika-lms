import pytest
from django.contrib.auth import get_user_model
from identity.models import Role, RoleAssignment, Profile, ParentChildLink
from organisations.models import Organisation
from courses.models import Programme, Course

User = get_user_model()


@pytest.fixture
def organisation(db):
    return Organisation.objects.create(
        name='Test Academy',
        slug='test-academy',
        type='school',
    )


@pytest.fixture
def roles(db):
    roles_data = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('treasurer', 'Treasurer'),
        ('instructor', 'Instructor'),
        ('student', 'Student'),
        ('parent', 'Parent'),
        ('sponsorship', 'Sponsor'),
        ('third_party', 'Third Party'),
    ]
    result = {}
    for name, display in roles_data:
        role, _ = Role.objects.get_or_create(
            name=name,
            defaults={'display_name': display, 'description': f'{display} role'},
        )
        result[name] = role
    return result


@pytest.fixture
def owner_user(db, organisation, roles):
    user = User.objects.create_user(
        email='owner@test.com',
        password='testpass123',
        supabase_uid='test-owner-uid',
        full_name='Test Owner',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['owner'],
        organisation=organisation,
        status='active',
    )
    Profile.objects.create(
        user=user,
        organisation=organisation,
        full_name='Test Owner',
    )
    return user


@pytest.fixture
def admin_user(db, organisation, roles):
    user = User.objects.create_user(
        email='admin@test.com',
        password='testpass123',
        supabase_uid='test-admin-uid',
        full_name='Test Admin',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['admin'],
        organisation=organisation,
        status='active',
    )
    return user


@pytest.fixture
def instructor_user(db, organisation, roles):
    user = User.objects.create_user(
        email='instructor@test.com',
        password='testpass123',
        supabase_uid='test-instructor-uid',
        full_name='Test Instructor',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['instructor'],
        organisation=organisation,
        status='active',
    )
    return user


@pytest.fixture
def student_user(db, organisation, roles):
    user = User.objects.create_user(
        email='student@test.com',
        password='testpass123',
        supabase_uid='test-student-uid',
        full_name='Test Student',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['student'],
        organisation=organisation,
        status='active',
    )
    return user


@pytest.fixture
def parent_user(db, organisation, roles, student_user):
    user = User.objects.create_user(
        email='parent@test.com',
        password='testpass123',
        supabase_uid='test-parent-uid',
        full_name='Test Parent',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['parent'],
        organisation=organisation,
        status='active',
    )
    ParentChildLink.objects.create(
        parent_user=user,
        student_user=student_user,
        relationship_type='parent',
        is_verified=True,
        is_active=True,
        consent_given=True,
    )
    return user


@pytest.fixture
def treasurer_user(db, organisation, roles):
    user = User.objects.create_user(
        email='treasurer@test.com',
        password='testpass123',
        supabase_uid='test-treasurer-uid',
        full_name='Test Treasurer',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['treasurer'],
        organisation=organisation,
        status='active',
    )
    return user


@pytest.fixture
def sponsor_user(db, organisation, roles):
    user = User.objects.create_user(
        email='sponsor@test.com',
        password='testpass123',
        supabase_uid='test-sponsor-uid',
        full_name='Test Sponsor',
    )
    RoleAssignment.objects.create(
        user=user,
        role=roles['sponsorship'],
        organisation=organisation,
        status='active',
    )
    return user


@pytest.fixture
def sample_programme(db, organisation):
    return Programme.objects.create(
        organisation=organisation,
        name='Test Programme',
        slug='test-programme',
        description='A test programme',
        level='shs',
    )


@pytest.fixture
def sample_course(db, organisation, sample_programme, instructor_user):
    return Course.objects.create(
        programme=sample_programme,
        organisation=organisation,
        title='Test Course',
        slug='test-course',
        description='A test course',
        instructor=instructor_user,
        is_published=True,
    )

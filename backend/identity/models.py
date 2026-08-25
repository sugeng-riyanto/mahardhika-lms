import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from core.models import TimestampedModel


class UserManager(BaseUserManager):
    """Custom user manager for UUID-based users."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser):
    """Application user linked to Supabase Auth."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supabase_uid = models.CharField(max_length=255, unique=True, db_index=True)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    mfa_enabled = models.BooleanField(default=False)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return self.email


class Profile(TimestampedModel):
    """User profile with additional information."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profiles',
    )
    full_name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    date_of_birth = models.DateField(null=True, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True, default='')
    preferred_language = models.CharField(
        max_length=5,
        choices=[('en', 'English'), ('id', 'Bahasa Indonesia')],
        default='en',
    )

    class Meta:
        db_table = 'profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name or self.user.email}'


class Role(TimestampedModel):
    """RBAC role definition."""

    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Administrator'),
        ('treasurer', 'Treasurer'),
        ('instructor', 'Instructor'),
        ('student', 'Student'),
        ('parent', 'Parent/Guardian'),
        ('sponsorship', 'Sponsor'),
        ('third_party', 'Third Party'),
    ]

    name = models.CharField(max_length=50, choices=ROLE_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'roles'
        ordering = ['name']

    def __str__(self):
        return self.display_name


class Permission(TimestampedModel):
    """Permission definition for RBAC."""

    name = models.CharField(max_length=100, unique=True)
    resource = models.CharField(max_length=100)
    action = models.CharField(max_length=50)
    description = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'permissions'
        ordering = ['resource', 'action']
        unique_together = ['resource', 'action']

    def __str__(self):
        return f'{self.resource}:{self.action}'


class RolePermission(TimestampedModel):
    """Many-to-many relationship between roles and permissions."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')

    class Meta:
        db_table = 'role_permissions'
        unique_together = ['role', 'permission']

    def __str__(self):
        return f'{self.role.name} -> {self.permission.name}'


class RoleAssignment(TimestampedModel):
    """Scoped role assignment for a user in an organisation."""

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('revoked', 'Revoked'),
        ('expired', 'Expired'),
    ]

    SCOPE_TYPE_CHOICES = [
        ('organisation', 'Organisation'),
        ('programme', 'Programme'),
        ('course', 'Course'),
        (None, 'Global'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='role_assignments')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='assignments')
    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.CASCADE,
        related_name='role_assignments',
    )
    scope_type = models.CharField(max_length=50, choices=SCOPE_TYPE_CHOICES, null=True, blank=True)
    scope_id = models.UUIDField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    valid_from = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    approver = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_assignments',
    )
    reason = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'role_assignments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['role', 'status']),
            models.Index(fields=['organisation', 'status']),
        ]

    def __str__(self):
        return f'{self.user.email} -> {self.role.name} ({self.status})'

    @property
    def is_valid(self):
        from django.utils import timezone
        if self.status != 'active':
            return False
        now = timezone.now()
        if self.valid_until and now > self.valid_until:
            return False
        return True


class ParentChildLink(TimestampedModel):
    """Parent-child relationship with consent tracking."""

    parent_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='parent_links',
    )
    student_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='child_links',
    )
    relationship_type = models.CharField(
        max_length=50,
        choices=[
            ('parent', 'Parent'),
            ('guardian', 'Guardian'),
            ('other', 'Other'),
        ],
        default='parent',
    )
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    consent_given = models.BooleanField(default=False)
    consent_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'parent_child_links'
        unique_together = ['parent_user', 'student_user']

    def __str__(self):
        return f'{self.parent_user.email} -> {self.student_user.email}'


class ThirdPartyGrant(TimestampedModel):
    """Time-bound, purpose-bound access grant for third parties."""

    third_party_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='third_party_grants',
    )
    organisation = models.ForeignKey(
        'organisations.Organisation',
        on_delete=models.CASCADE,
        related_name='third_party_grants',
    )
    purpose = models.CharField(max_length=255)
    scope_type = models.CharField(max_length=50)
    scope_id = models.UUIDField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField()
    granted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='granted_third_party',
    )

    class Meta:
        db_table = 'third_party_grants'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.third_party_user.email} -> {self.purpose}'

    @property
    def is_valid(self):
        from django.utils import timezone
        now = timezone.now()
        return self.is_active and now <= self.valid_until

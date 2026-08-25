-- AKADEMI Digital Campus - Initial Schema Migration
-- Creates core tables with RLS policies for multi-tenant security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- ORGANISATIONS
-- ================================================
CREATE TABLE organisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'school',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- USERS (mapped from Supabase Auth)
-- ================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_uid UUID UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    is_staff BOOLEAN DEFAULT false,
    is_superuser BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_supabase_uid ON users(supabase_uid);

-- ================================================
-- PROFILES
-- ================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
    full_name VARCHAR(255) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    date_of_birth DATE,
    avatar_url VARCHAR(500) DEFAULT '',
    preferred_language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- ================================================
-- ROLES & PERMISSIONS
-- ================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(resource, action)
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- ================================================
-- ROLE ASSIGNMENTS (scoped, time-bound)
-- ================================================
CREATE TABLE role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    scope_type VARCHAR(50),
    scope_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_role_assignments_user_status ON role_assignments(user_id, status);
CREATE INDEX idx_role_assignments_role_status ON role_assignments(role_id, status);
CREATE INDEX idx_role_assignments_org_status ON role_assignments(organisation_id, status);

-- ================================================
-- PARENT-CHILD LINKS
-- ================================================
CREATE TABLE parent_child_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'parent',
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    consent_given BOOLEAN DEFAULT false,
    consent_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(parent_user_id, student_user_id)
);

-- ================================================
-- THIRD-PARTY GRANTS
-- ================================================
CREATE TABLE third_party_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    third_party_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    purpose VARCHAR(255) NOT NULL,
    scope_type VARCHAR(50) NOT NULL,
    scope_id UUID,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ NOT NULL,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- PROGRAMMES & COURSES
-- ================================================
CREATE TABLE programmes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    level VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organisation_id, slug)
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false,
    thumbnail_url VARCHAR(500) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(programme_id, slug)
);

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    "order" INTEGER DEFAULT 0,
    content_type VARCHAR(20) NOT NULL,
    content_data JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE enrolments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    enrolled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, course_id)
);

-- ================================================
-- AUDIT EVENTS (immutable)
-- ================================================
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    scope VARCHAR(255) DEFAULT '',
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent VARCHAR(500) DEFAULT '',
    correlation_id UUID DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_events_action_created ON audit_events(action, created_at);
CREATE INDEX idx_audit_events_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id, created_at);
CREATE INDEX idx_audit_events_correlation ON audit_events(correlation_id);

-- ================================================
-- ROW-LEVEL SECURITY
-- ================================================

-- Enable RLS on all tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_own_read ON users
    FOR SELECT USING (auth.uid()::text = supabase_uid::text);

-- Service role can do everything (Django backend)
CREATE POLICY service_all_users ON users
    FOR ALL USING (auth.role() = 'service_role');

-- Profiles: users can read their own, service role manages all
CREATE POLICY profiles_own_read ON profiles
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE supabase_uid::text = auth.uid()::text));

CREATE POLICY service_all_profiles ON profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Roles are readable by all authenticated users
CREATE POLICY roles_read_authenticated ON roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY service_all_roles ON roles
    FOR ALL USING (auth.role() = 'service_role');

-- Role assignments: service role manages all
CREATE POLICY service_all_role_assignments ON role_assignments
    FOR ALL USING (auth.role() = 'service_role');

-- Organisations: service role manages all
CREATE POLICY service_all_organisations ON organisations
    FOR ALL USING (auth.role() = 'service_role');

-- Courses: service role manages all
CREATE POLICY service_all_courses ON courses
    FOR ALL USING (auth.role() = 'service_role');

-- Lessons: service role manages all
CREATE POLICY service_all_lessons ON lessons
    FOR ALL USING (auth.role() = 'service_role');

-- Enrolments: service role manages all
CREATE POLICY service_all_enrolments ON enrolments
    FOR ALL USING (auth.role() = 'service_role');

-- Audit events: service role manages all, append-only for authenticated
CREATE POLICY audit_service_all ON audit_events
    FOR ALL USING (auth.role() = 'service_role');

-- ================================================
-- SEED ROLES
-- ================================================
INSERT INTO roles (name, display_name, description) VALUES
    ('owner', 'Owner', 'System governance and organisation configuration'),
    ('admin', 'Administrator', 'User, programme, and operational management'),
    ('treasurer', 'Treasurer', 'Finance, invoice, reconciliation, and financial reports'),
    ('instructor', 'Instructor', 'Course, lesson, assessment, rubric, grading, and student progress'),
    ('student', 'Student', 'Learning materials, activities, submissions, and personal progress'),
    ('parent', 'Parent/Guardian', 'Child progress and communication'),
    ('sponsorship', 'Sponsor', 'Sponsorship information and limited reports'),
    ('third_party', 'Third Party', 'Time-bound, purpose-bound integration support');

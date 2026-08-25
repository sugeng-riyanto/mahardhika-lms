-- =====================================================
-- AKADEMI Digital Campus — Apply Schema to Supabase
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ORGANISATIONS
CREATE TABLE IF NOT EXISTS organisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'school',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- USERS (mapped from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
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

-- ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- ROLE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS role_assignments (
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

CREATE INDEX IF NOT EXISTS idx_role_assignments_user_status ON role_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_status ON role_assignments(role_id, status);
CREATE INDEX IF NOT EXISTS idx_role_assignments_org_status ON role_assignments(organisation_id, status);

-- PARENT-CHILD LINKS
CREATE TABLE IF NOT EXISTS parent_child_links (
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

-- THIRD-PARTY GRANTS
CREATE TABLE IF NOT EXISTS third_party_grants (
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

-- PROGRAMMES & COURSES
CREATE TABLE IF NOT EXISTS programmes (
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

CREATE TABLE IF NOT EXISTS courses (
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

CREATE TABLE IF NOT EXISTS lessons (
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

CREATE TABLE IF NOT EXISTS enrolments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    enrolled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, course_id)
);

-- AUDIT EVENTS (immutable)
CREATE TABLE IF NOT EXISTS audit_events (
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

CREATE INDEX IF NOT EXISTS idx_audit_events_action_created ON audit_events(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation ON audit_events(correlation_id);

-- ================================================
-- HELPER FUNCTIONS (for RLS policies)
-- ================================================

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.users WHERE supabase_uid = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role(role_name TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_assignments ra
    JOIN public.roles r ON r.id = ra.role_id
    WHERE ra.user_id = public.get_user_id()
      AND r.name = role_name
      AND ra.status = 'active'
      AND ra.valid_from <= now()
      AND (ra.valid_until IS NULL OR ra.valid_until > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_role(role_names TEXT[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_assignments ra
    JOIN public.roles r ON r.id = ra.role_id
    WHERE ra.user_id = public.get_user_id()
      AND r.name = ANY(role_names)
      AND ra.status = 'active'
      AND ra.valid_from <= now()
      AND (ra.valid_until IS NULL OR ra.valid_until > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT public.user_has_any_role(ARRAY['owner', 'admin']);
$$;

CREATE OR REPLACE FUNCTION public.user_in_org(org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_assignments
    WHERE user_id = public.get_user_id()
      AND organisation_id = org_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_verified_parent_of(student_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_user_id = public.get_user_id()
      AND student_user_id = $1
      AND is_verified = true
      AND is_active = true
      AND consent_given = true
  );
$$;

CREATE OR REPLACE FUNCTION public.student_enrolled_in_course(course_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrolments
    WHERE student_id = public.get_user_id()
      AND course_id = $1
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_instructor_of_course(course_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = $1 AND instructor_id = public.get_user_id()
  );
$$;

-- ================================================
-- ROW-LEVEL SECURITY POLICIES
-- ================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE third_party_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- === USERS ===
CREATE POLICY users_service_all ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY users_own_read ON users FOR SELECT USING (supabase_uid = auth.uid());
CREATE POLICY users_own_update ON users FOR UPDATE USING (supabase_uid = auth.uid()) WITH CHECK (supabase_uid = auth.uid());
CREATE POLICY users_admin_read ON users FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY users_admin_insert ON users FOR INSERT WITH CHECK (public.is_admin_or_owner());
CREATE POLICY users_admin_update ON users FOR UPDATE USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

-- === PROFILES ===
CREATE POLICY profiles_service_all ON profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY profiles_own_read ON profiles FOR SELECT USING (user_id = public.get_user_id());
CREATE POLICY profiles_own_update ON profiles FOR UPDATE USING (user_id = public.get_user_id()) WITH CHECK (user_id = public.get_user_id());
CREATE POLICY profiles_own_insert ON profiles FOR INSERT WITH CHECK (user_id = public.get_user_id());
CREATE POLICY profiles_admin_read ON profiles FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY profiles_parent_read ON profiles FOR SELECT USING (public.is_verified_parent_of(user_id));
CREATE POLICY profiles_instructor_read ON profiles FOR SELECT USING (
    public.user_has_role('instructor') AND EXISTS (
      SELECT 1 FROM public.enrolments e JOIN public.courses c ON c.id = e.course_id
      WHERE e.student_id = profiles.user_id AND c.instructor_id = public.get_user_id() AND e.status = 'active'
    )
);

-- === ROLES & PERMISSIONS (read-only for all authenticated) ===
CREATE POLICY roles_service_all ON roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY roles_auth_read ON roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY permissions_service_all ON permissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY permissions_auth_read ON permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY role_permissions_service_all ON role_permissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY role_permissions_auth_read ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');

-- === ROLE ASSIGNMENTS ===
CREATE POLICY role_assignments_service_all ON role_assignments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY role_assignments_own_read ON role_assignments FOR SELECT USING (user_id = public.get_user_id());
CREATE POLICY role_assignments_admin_read ON role_assignments FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY role_assignments_admin_insert ON role_assignments FOR INSERT WITH CHECK (public.is_admin_or_owner());
CREATE POLICY role_assignments_admin_update ON role_assignments FOR UPDATE USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY role_assignments_admin_delete ON role_assignments FOR DELETE USING (public.is_admin_or_owner());

-- === ORGANISATIONS ===
CREATE POLICY organisations_service_all ON organisations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY organisations_member_read ON organisations FOR SELECT USING (public.user_in_org(id));
CREATE POLICY organisations_admin_update ON organisations FOR UPDATE USING (public.is_admin_or_owner() AND public.user_in_org(id)) WITH CHECK (public.is_admin_or_owner());

-- === PARENT-CHILD LINKS ===
CREATE POLICY parent_child_links_service_all ON parent_child_links FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY parent_child_links_parent_read ON parent_child_links FOR SELECT USING (parent_user_id = public.get_user_id());
CREATE POLICY parent_child_links_parent_insert ON parent_child_links FOR INSERT WITH CHECK (parent_user_id = public.get_user_id());
CREATE POLICY parent_child_links_student_read ON parent_child_links FOR SELECT USING (student_user_id = public.get_user_id());
CREATE POLICY parent_child_links_admin_manage ON parent_child_links FOR ALL USING (public.is_admin_or_owner());

-- === THIRD-PARTY GRANTS ===
CREATE POLICY third_party_grants_service_all ON third_party_grants FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY third_party_grants_own_read ON third_party_grants FOR SELECT USING (third_party_user_id = public.get_user_id() AND is_active = true AND valid_until > now());
CREATE POLICY third_party_grants_admin_manage ON third_party_grants FOR ALL USING (public.is_admin_or_owner());

-- === PROGRAMMES ===
CREATE POLICY programmes_service_all ON programmes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY programmes_member_read ON programmes FOR SELECT USING (public.user_in_org(organisation_id));
CREATE POLICY programmes_admin_manage ON programmes FOR ALL USING (public.is_admin_or_owner());

-- === COURSES ===
CREATE POLICY courses_service_all ON courses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY courses_admin_manage ON courses FOR ALL USING (public.is_admin_or_owner() AND public.user_in_org(organisation_id));
CREATE POLICY courses_instructor_read ON courses FOR SELECT USING (instructor_id = public.get_user_id());
CREATE POLICY courses_instructor_update ON courses FOR UPDATE USING (instructor_id = public.get_user_id()) WITH CHECK (instructor_id = public.get_user_id());
CREATE POLICY courses_student_enrolled_read ON courses FOR SELECT USING (public.user_has_role('student') AND public.student_enrolled_in_course(id));
CREATE POLICY courses_student_org_read ON courses FOR SELECT USING (public.user_has_role('student') AND is_published = true AND public.user_in_org(organisation_id));
CREATE POLICY courses_parent_child_read ON courses FOR SELECT USING (
    public.user_has_role('parent') AND EXISTS (
      SELECT 1 FROM public.enrolments e WHERE e.course_id = courses.id AND e.status = 'active' AND public.is_verified_parent_of(e.student_id)
    )
);
CREATE POLICY courses_sponsor_read ON courses FOR SELECT USING (public.user_has_role('sponsorship') AND is_published = true AND public.user_in_org(organisation_id));

-- === LESSONS ===
CREATE POLICY lessons_service_all ON lessons FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY lessons_admin_manage ON lessons FOR ALL USING (public.is_admin_or_owner() AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND public.user_in_org(c.organisation_id)));
CREATE POLICY lessons_instructor_read ON lessons FOR SELECT USING (public.is_instructor_of_course(course_id));
CREATE POLICY lessons_instructor_update ON lessons FOR UPDATE USING (public.is_instructor_of_course(course_id)) WITH CHECK (public.is_instructor_of_course(course_id));
CREATE POLICY lessons_instructor_insert ON lessons FOR INSERT WITH CHECK (public.is_instructor_of_course(course_id));
CREATE POLICY lessons_student_read ON lessons FOR SELECT USING (public.user_has_role('student') AND is_published = true AND public.student_enrolled_in_course(course_id));
CREATE POLICY lessons_parent_read ON lessons FOR SELECT USING (public.user_has_role('parent') AND is_published = true AND EXISTS (SELECT 1 FROM public.enrolments e WHERE e.course_id = lessons.course_id AND e.status = 'active' AND public.is_verified_parent_of(e.student_id)));

-- === ENROLMENTS ===
CREATE POLICY enrolments_service_all ON enrolments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY enrolments_student_read ON enrolments FOR SELECT USING (student_id = public.get_user_id());
CREATE POLICY enrolments_admin_manage ON enrolments FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY enrolments_instructor_read ON enrolments FOR SELECT USING (public.user_has_role('instructor') AND public.is_instructor_of_course(course_id));
CREATE POLICY enrolments_parent_read ON enrolments FOR SELECT USING (public.user_has_role('parent') AND public.is_verified_parent_of(student_id));

-- === AUDIT EVENTS ===
CREATE POLICY audit_events_service_all ON audit_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY audit_events_admin_read ON audit_events FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY audit_events_own_read ON audit_events FOR SELECT USING (actor_id = public.get_user_id());

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
    ('third_party', 'Third Party', 'Time-bound, purpose-bound integration support')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- SEED PERMISSIONS
-- ================================================

INSERT INTO permissions (name, resource, action, description) VALUES
    ('users.read', 'users', 'read', 'Read user profiles'),
    ('users.create', 'users', 'create', 'Create new users'),
    ('users.update', 'users', 'update', 'Update user profiles'),
    ('users.delete', 'users', 'delete', 'Deactivate users'),
    ('courses.read', 'courses', 'read', 'Read courses'),
    ('courses.create', 'courses', 'create', 'Create courses'),
    ('courses.update', 'courses', 'update', 'Update courses'),
    ('courses.delete', 'courses', 'delete', 'Delete courses'),
    ('lessons.read', 'lessons', 'read', 'Read lessons'),
    ('lessons.create', 'lessons', 'create', 'Create lessons'),
    ('lessons.update', 'lessons', 'update', 'Update lessons'),
    ('lessons.delete', 'lessons', 'delete', 'Delete lessons'),
    ('grades.read', 'grades', 'read', 'Read grades'),
    ('grades.create', 'grades', 'create', 'Create grades'),
    ('grades.update', 'grades', 'update', 'Update grades'),
    ('grades.release', 'grades', 'release', 'Release grades to students'),
    ('enrolments.read', 'enrolments', 'read', 'Read enrolments'),
    ('enrolments.create', 'enrolments', 'create', 'Enrol students'),
    ('enrolments.delete', 'enrolments', 'delete', 'Drop enrolments'),
    ('finance.read', 'finance', 'read', 'Read financial records'),
    ('finance.create', 'finance', 'create', 'Create invoices'),
    ('finance.update', 'finance', 'update', 'Update invoices'),
    ('audit.read', 'audit', 'read', 'Read audit log'),
    ('settings.manage', 'settings', 'manage', 'Manage organisation settings'),
    ('roles.manage', 'roles', 'manage', 'Manage role assignments'),
    ('content.read', 'content', 'read', 'Read content library'),
    ('content.create', 'content', 'create', 'Upload content'),
    ('content.update', 'content', 'update', 'Update content'),
    ('content.delete', 'content', 'delete', 'Delete content'),
    ('canvas.read', 'canvas', 'read', 'Read canvas documents'),
    ('canvas.update', 'canvas', 'update', 'Update canvas (layer-specific)'),
    ('canvas.submit', 'canvas', 'submit', 'Submit canvas for assessment'),
    ('essays.read', 'essays', 'read', 'Read essay questions'),
    ('essays.create', 'essays', 'create', 'Create essay questions'),
    ('essays.update', 'essays', 'update', 'Update essay questions'),
    ('safeguarding.read', 'safeguarding', 'read', 'Read safeguarding reports'),
    ('safeguarding.create', 'safeguarding', 'create', 'Create safeguarding reports'),
    ('notifications.read', 'notifications', 'read', 'Read own notifications'),
    ('notifications.create', 'notifications', 'create', 'Create notifications (admin)')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- SEED ROLE-PERMISSION MAPPINGS
-- ================================================

-- Owner: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- Admin: everything except finance.write
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name NOT IN ('finance.create', 'finance.update')
ON CONFLICT DO NOTHING;

-- Treasurer: finance + audit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'treasurer' AND p.resource IN ('finance', 'audit')
ON CONFLICT DO NOTHING;

-- Instructor: courses, lessons, grades, content, canvas, essays
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'instructor' AND p.resource IN ('courses', 'lessons', 'grades', 'content', 'canvas', 'essays')
ON CONFLICT DO NOTHING;

-- Student: read-only + canvas.submit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'student' AND (p.action = 'read' OR p.name = 'canvas.submit')
ON CONFLICT DO NOTHING;

-- Parent: read-only on academic data
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'parent' AND p.action = 'read'
  AND p.resource IN ('courses', 'lessons', 'grades', 'enrolments', 'notifications')
ON CONFLICT DO NOTHING;

-- Sponsor: read-only on courses, lessons, grades
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'sponsorship' AND p.action = 'read'
  AND p.resource IN ('courses', 'lessons', 'grades')
ON CONFLICT DO NOTHING;

-- Done! Verify by running: SELECT * FROM roles; SELECT * FROM permissions;

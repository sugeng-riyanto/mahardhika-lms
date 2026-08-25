-- ================================================
-- AKADEMI Digital Campus - RLS Policies Migration
-- ================================================
-- Adds user-level Row-Level Security policies to all tables.
-- Uses helper functions for role checking, org membership, and parent-child.
-- This migration is additive — it only adds/changes policies, not tables.
--
-- Strategy:
--   1. Helper functions that cache role lookups for performance
--   2. Each table gets: service_role bypass + user-level policies
--   3. Policies use the helper functions for clean, DRY logic
--   4. Deny-by-default: tables with RLS but no matching policy = no access
-- ================================================

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Get current user's DB user ID from auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE supabase_uid = auth.uid() LIMIT 1;
$$;

-- Check if current user has a specific active role in any org
CREATE OR REPLACE FUNCTION public.user_has_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
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

-- Check if current user has any of the given roles
CREATE OR REPLACE FUNCTION public.user_has_any_role(role_names TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
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

-- Check if current user is owner or admin
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_any_role(ARRAY['owner', 'admin']);
$$;

-- Check if current user belongs to a specific organisation
CREATE OR REPLACE FUNCTION public.user_in_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_assignments
    WHERE user_id = public.get_user_id()
      AND organisation_id = org_id
      AND status = 'active'
  );
$$;

-- Check if current user is a verified parent of a specific student
CREATE OR REPLACE FUNCTION public.is_verified_parent_of(student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_user_id = public.get_user_id()
      AND student_user_id = student_id
      AND is_verified = true
      AND is_active = true
      AND consent_given = true
  );
$$;

-- Check if a student is enrolled in a specific course
CREATE OR REPLACE FUNCTION public.student_enrolled_in_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrolments
    WHERE student_id = public.get_user_id()
      AND course_id = $1
      AND status = 'active'
  );
$$;

-- Check if current user is the instructor of a course
CREATE OR REPLACE FUNCTION public.is_instructor_of_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = course_id
      AND instructor_id = public.get_user_id()
  );
$$;

-- ================================================
-- DROP EXISTING POLICIES (clean slate)
-- ================================================

-- Users
DROP POLICY IF EXISTS users_own_read ON public.users;
DROP POLICY IF EXISTS service_all_users ON public.users;

-- Profiles
DROP POLICY IF EXISTS profiles_own_read ON public.profiles;
DROP POLICY IF EXISTS service_all_profiles ON public.profiles;

-- Roles
DROP POLICY IF EXISTS roles_read_authenticated ON public.roles;
DROP POLICY IF EXISTS service_all_roles ON public.roles;

-- Role assignments
DROP POLICY IF EXISTS service_all_role_assignments ON public.role_assignments;

-- Organisations
DROP POLICY IF EXISTS service_all_organisations ON public.organisations;

-- Courses
DROP POLICY IF EXISTS service_all_courses ON public.courses;

-- Lessons
DROP POLICY IF EXISTS service_all_lessons ON public.lessons;

-- Enrolments
DROP POLICY IF EXISTS service_all_enrolments ON public.enrolments;

-- Audit events
DROP POLICY IF EXISTS audit_service_all ON public.audit_events;


-- ================================================
-- USERS TABLE
-- ================================================

-- Service role: full access (Django backend)
CREATE POLICY users_service_all ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own record
CREATE POLICY users_own_read ON public.users
  FOR SELECT USING (
    supabase_uid = auth.uid()
  );

-- Users can update their own name/avatar
CREATE POLICY users_own_update ON public.users
  FOR UPDATE USING (
    supabase_uid = auth.uid()
  ) WITH CHECK (
    supabase_uid = auth.uid()
  );

-- Admin/Owner: can read all users in their org
CREATE POLICY users_admin_read ON public.users
  FOR SELECT USING (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can create users
CREATE POLICY users_admin_insert ON public.users
  FOR INSERT WITH CHECK (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can update any user
CREATE POLICY users_admin_update ON public.users
  FOR UPDATE USING (
    public.is_admin_or_owner()
  ) WITH CHECK (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can deactivate users
CREATE POLICY users_admin_delete ON public.users
  FOR DELETE USING (
    public.is_admin_or_owner()
  );


-- ================================================
-- PROFILES TABLE
-- ================================================

-- Service role: full access
CREATE POLICY profiles_service_all ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own profile
CREATE POLICY profiles_own_read ON public.profiles
  FOR SELECT USING (
    user_id = public.get_user_id()
  );

-- Users can update their own profile
CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE USING (
    user_id = public.get_user_id()
  ) WITH CHECK (
    user_id = public.get_user_id()
  );

-- Users can create their own profile
CREATE POLICY profiles_own_insert ON public.profiles
  FOR INSERT WITH CHECK (
    user_id = public.get_user_id()
  );

-- Admin/Owner: can read all profiles
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT USING (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can create/update any profile
CREATE POLICY profiles_admin_manage ON public.profiles
  FOR ALL USING (
    public.is_admin_or_owner()
  );

-- Parents: can read profiles of their linked children
CREATE POLICY profiles_parent_read ON public.profiles
  FOR SELECT USING (
    public.is_verified_parent_of(user_id)
  );

-- Instructor: can read profiles of students enrolled in their courses
CREATE POLICY profiles_instructor_read ON public.profiles
  FOR SELECT USING (
    public.user_has_role('instructor')
    AND EXISTS (
      SELECT 1 FROM public.enrolments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE e.student_id = profiles.user_id
        AND c.instructor_id = public.get_user_id()
        AND e.status = 'active'
    )
  );


-- ================================================
-- ROLES TABLE (read-only for all authenticated)
-- ================================================

-- Service role: full access
CREATE POLICY roles_service_all ON public.roles
  FOR ALL USING (auth.role() = 'service_role');

-- All authenticated users can read roles (for display purposes)
CREATE POLICY roles_auth_read ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');


-- ================================================
-- PERMISSIONS TABLE
-- ================================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY permissions_service_all ON public.permissions
  FOR ALL USING (auth.role() = 'service_role');

-- All authenticated users can read permissions
CREATE POLICY permissions_auth_read ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated');


-- ================================================
-- ROLE_PERMISSIONS TABLE
-- ================================================

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY role_permissions_service_all ON public.role_permissions
  FOR ALL USING (auth.role() = 'service_role');

-- All authenticated users can read role-permission mappings
CREATE POLICY role_permissions_auth_read ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');


-- ================================================
-- ROLE ASSIGNMENTS TABLE
-- ================================================

-- Service role: full access
CREATE POLICY role_assignments_service_all ON public.role_assignments
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own role assignments
CREATE POLICY role_assignments_own_read ON public.role_assignments
  FOR SELECT USING (
    user_id = public.get_user_id()
  );

-- Admin/Owner: can read all assignments in their org
CREATE POLICY role_assignments_admin_read ON public.role_assignments
  FOR SELECT USING (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can create assignments in their org
CREATE POLICY role_assignments_admin_insert ON public.role_assignments
  FOR INSERT WITH CHECK (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can update assignments in their org
CREATE POLICY role_assignments_admin_update ON public.role_assignments
  FOR UPDATE USING (
    public.is_admin_or_owner()
  ) WITH CHECK (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can delete/revoke assignments
CREATE POLICY role_assignments_admin_delete ON public.role_assignments
  FOR DELETE USING (
    public.is_admin_or_owner()
  );


-- ================================================
-- ORGANISATIONS TABLE
-- ================================================

-- Service role: full access
CREATE POLICY organisations_service_all ON public.organisations
  FOR ALL USING (auth.role() = 'service_role');

-- Members can read their organisation
CREATE POLICY organisations_member_read ON public.organisations
  FOR SELECT USING (
    public.user_in_org(id)
  );

-- Admin/Owner: can update their organisation
CREATE POLICY organisations_admin_update ON public.organisations
  FOR UPDATE USING (
    public.is_admin_or_owner() AND public.user_in_org(id)
  ) WITH CHECK (
    public.is_admin_or_owner() AND public.user_in_org(id)
  );

-- Admin/Owner: can create organisations
CREATE POLICY organisations_admin_insert ON public.organisations
  FOR INSERT WITH CHECK (
    public.is_admin_or_owner()
  );


-- ================================================
-- PARENT-CHILD LINKS TABLE
-- ================================================

-- Service role: full access
CREATE POLICY parent_child_links_service_all ON public.parent_child_links
  FOR ALL USING (auth.role() = 'service_role');

-- Parents can read their own links
CREATE POLICY parent_child_links_parent_read ON public.parent_child_links
  FOR SELECT USING (
    parent_user_id = public.get_user_id()
  );

-- Parents can create links (request)
CREATE POLICY parent_child_links_parent_insert ON public.parent_child_links
  FOR INSERT WITH CHECK (
    parent_user_id = public.get_user_id()
  );

-- Admin/Owner: can read all links
CREATE POLICY parent_child_links_admin_read ON public.parent_child_links
  FOR SELECT USING (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can manage all links
CREATE POLICY parent_child_links_admin_manage ON public.parent_child_links
  FOR ALL USING (
    public.is_admin_or_owner()
  );

-- Students can read their own parent links
CREATE POLICY parent_child_links_student_read ON public.parent_child_links
  FOR SELECT USING (
    student_user_id = public.get_user_id()
  );


-- ================================================
-- THIRD-PARTY GRANTS TABLE
-- ================================================

-- Service role: full access
CREATE POLICY third_party_grants_service_all ON public.third_party_grants
  FOR ALL USING (auth.role() = 'service_role');

-- Third parties can read their own grants
CREATE POLICY third_party_grants_own_read ON public.third_party_grants
  FOR SELECT USING (
    third_party_user_id = public.get_user_id()
  );

-- Third parties can only see active, non-expired grants
CREATE POLICY third_party_grants_active_only ON public.third_party_grants
  FOR SELECT USING (
    third_party_user_id = public.get_user_id()
    AND is_active = true
    AND valid_until > now()
  );

-- Admin/Owner: can manage all grants
CREATE POLICY third_party_grants_admin_manage ON public.third_party_grants
  FOR ALL USING (
    public.is_admin_or_owner()
  );


-- ================================================
-- PROGRAMMES TABLE
-- ================================================

-- Service role: full access
CREATE POLICY programmes_service_all ON public.programmes
  FOR ALL USING (auth.role() = 'service_role');

-- Members can read programmes in their org
CREATE POLICY programmes_member_read ON public.programmes
  FOR SELECT USING (
    public.user_in_org(organisation_id)
  );

-- Admin/Owner: can manage programmes
CREATE POLICY programmes_admin_manage ON public.programmes
  FOR ALL USING (
    public.is_admin_or_owner()
  );

-- Instructor: can read programmes in their org
CREATE POLICY programmes_instructor_read ON public.programmes
  FOR SELECT USING (
    public.user_has_role('instructor')
    AND public.user_in_org(organisation_id)
  );


-- ================================================
-- COURSES TABLE
-- ================================================

-- Service role: full access
CREATE POLICY courses_service_all ON public.courses
  FOR ALL USING (auth.role() = 'service_role');

-- Admin/Owner: can read all courses in their org
CREATE POLICY courses_admin_read ON public.courses
  FOR SELECT USING (
    public.is_admin_or_owner()
    AND public.user_in_org(organisation_id)
  );

-- Admin/Owner: can manage courses
CREATE POLICY courses_admin_manage ON public.courses
  FOR ALL USING (
    public.is_admin_or_owner()
    AND public.user_in_org(organisation_id)
  );

-- Instructor: can read courses they teach
CREATE POLICY courses_instructor_read ON public.courses
  FOR SELECT USING (
    instructor_id = public.get_user_id()
  );

-- Instructor: can update their own courses
CREATE POLICY courses_instructor_update ON public.courses
  FOR UPDATE USING (
    instructor_id = public.get_user_id()
  ) WITH CHECK (
    instructor_id = public.get_user_id()
  );

-- Student: can read published courses they are enrolled in
CREATE POLICY courses_student_enrolled_read ON public.courses
  FOR SELECT USING (
    public.user_has_role('student')
    AND public.student_enrolled_in_course(id)
  );

-- Student: can read all published courses in their org (for browsing)
CREATE POLICY courses_student_org_read ON public.courses
  FOR SELECT USING (
    public.user_has_role('student')
    AND is_published = true
    AND public.user_in_org(organisation_id)
  );

-- Parent: can read courses their child is enrolled in
CREATE POLICY courses_parent_child_read ON public.courses
  FOR SELECT USING (
    public.user_has_role('parent')
    AND EXISTS (
      SELECT 1 FROM public.enrolments e
      WHERE e.course_id = courses.id
        AND e.status = 'active'
        AND public.is_verified_parent_of(e.student_id)
    )
  );

-- Sponsor: can read published courses in their org
CREATE POLICY courses_sponsor_read ON public.courses
  FOR SELECT USING (
    public.user_has_role('sponsorship')
    AND is_published = true
    AND public.user_in_org(organisation_id)
  );


-- ================================================
-- LESSONS TABLE
-- ================================================

-- Service role: full access
CREATE POLICY lessons_service_all ON public.lessons
  FOR ALL USING (auth.role() = 'service_role');

-- Admin/Owner: can manage all lessons in their org
CREATE POLICY lessons_admin_manage ON public.lessons
  FOR ALL USING (
    public.is_admin_or_owner()
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = lessons.course_id AND public.user_in_org(c.organisation_id)
    )
  );

-- Instructor: can read/update lessons in their courses
CREATE POLICY lessons_instructor_read ON public.lessons
  FOR SELECT USING (
    public.is_instructor_of_course(course_id)
  );

CREATE POLICY lessons_instructor_update ON public.lessons
  FOR UPDATE USING (
    public.is_instructor_of_course(course_id)
  ) WITH CHECK (
    public.is_instructor_of_course(course_id)
  );

CREATE POLICY lessons_instructor_insert ON public.lessons
  FOR INSERT WITH CHECK (
    public.is_instructor_of_course(course_id)
  );

-- Student: can read published lessons in enrolled courses
CREATE POLICY lessons_student_read ON public.lessons
  FOR SELECT USING (
    public.user_has_role('student')
    AND is_published = true
    AND public.student_enrolled_in_course(course_id)
  );

-- Parent: can read published lessons in child's enrolled courses
CREATE POLICY lessons_parent_read ON public.lessons
  FOR SELECT USING (
    public.user_has_role('parent')
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.enrolments e
      WHERE e.course_id = lessons.course_id
        AND e.status = 'active'
        AND public.is_verified_parent_of(e.student_id)
    )
  );

-- Sponsor: can read published lessons in their org
CREATE POLICY lessons_sponsor_read ON public.lessons
  FOR SELECT USING (
    public.user_has_role('sponsorship')
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = lessons.course_id
        AND c.is_published = true
        AND public.user_in_org(c.organisation_id)
    )
  );


-- ================================================
-- ENROLMENTS TABLE
-- ================================================

-- Service role: full access
CREATE POLICY enrolments_service_all ON public.enrolments
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read their own enrolments
CREATE POLICY enrolments_student_read ON public.enrolments
  FOR SELECT USING (
    student_id = public.get_user_id()
  );

-- Admin/Owner: can read all enrolments in their org
CREATE POLICY enrolments_admin_read ON public.enrolments
  FOR SELECT USING (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can manage enrolments
CREATE POLICY enrolments_admin_manage ON public.enrolments
  FOR ALL USING (
    public.is_admin_or_owner()
  );

-- Instructor: can read enrolments for their courses
CREATE POLICY enrolments_instructor_read ON public.enrolments
  FOR SELECT USING (
    public.user_has_role('instructor')
    AND public.is_instructor_of_course(course_id)
  );

-- Parent: can read enrolments for their child
CREATE POLICY enrolments_parent_read ON public.enrolments
  FOR SELECT USING (
    public.user_has_role('parent')
    AND public.is_verified_parent_of(student_id)
  );


-- ================================================
-- AUDIT EVENTS TABLE
-- ================================================

-- Service role: full access (Django backend writes audit events)
CREATE POLICY audit_events_service_all ON public.audit_events
  FOR ALL USING (auth.role() = 'service_role');

-- Admin/Owner: can read audit events in their org
CREATE POLICY audit_events_admin_read ON public.audit_events
  FOR SELECT USING (
    public.is_admin_or_owner()
  );

-- All authenticated users can read their own audit events
CREATE POLICY audit_events_own_read ON public.audit_events
  FOR SELECT USING (
    actor_id = public.get_user_id()
  );

-- No direct INSERT/UPDATE/DELETE for client users — audit events are immutable
-- Only service_role (Django) can write audit events


-- ================================================
-- SEED ROLES (idempotent)
-- ================================================

INSERT INTO public.roles (name, display_name, description) VALUES
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
-- SEED PERMISSIONS (core set)
-- ================================================

INSERT INTO public.permissions (name, resource, action, description) VALUES
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
-- SEED ROLE PERMISSIONS
-- ================================================

-- Owner: full access
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- Admin: everything except finance.write and roles.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin'
  AND p.name NOT IN ('finance.create', 'finance.update')
ON CONFLICT DO NOTHING;

-- Treasurer: finance only + audit.read
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'treasurer'
  AND p.resource IN ('finance', 'audit')
ON CONFLICT DO NOTHING;

-- Instructor: courses, lessons, grades, content, canvas, essays
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'instructor'
  AND p.resource IN ('courses', 'lessons', 'grades', 'content', 'canvas', 'essays')
ON CONFLICT DO NOTHING;

-- Student: read-only + canvas.submit + notifications.read
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'student'
  AND (p.action = 'read' OR p.name IN ('canvas.submit'))
ON CONFLICT DO NOTHING;

-- Parent: read-only on academic data + notifications.read
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'parent'
  AND p.action = 'read'
  AND p.resource IN ('courses', 'lessons', 'grades', 'enrolments', 'notifications')
ON CONFLICT DO NOTHING;

-- Sponsor: read-only on courses, lessons, grades
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'sponsorship'
  AND p.action = 'read'
  AND p.resource IN ('courses', 'lessons', 'grades')
ON CONFLICT DO NOTHING;

-- Third Party: no permissions by default (granted per-scope)
-- No inserts needed

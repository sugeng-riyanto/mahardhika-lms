-- ================================================
-- AKADEMI — Helper Functions + Core Table RLS
-- Compatible with Django-created schema
-- Fix: supabase_uid is varchar, auth.uid() is uuid
-- ================================================

-- Get current user's Django user ID from auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE supabase_uid = auth.uid()::text LIMIT 1;
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
  );
$$;

-- Is current user admin or owner?
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_any_role(ARRAY['owner', 'admin']);
$$;

-- Is current user in a given org?
CREATE OR REPLACE FUNCTION public.user_in_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_assignments ra
    WHERE ra.user_id = public.get_user_id()
      AND ra.organisation_id = org_id
      AND ra.status = 'active'
  );
$$;

-- Is current user an instructor of a given course?
CREATE OR REPLACE FUNCTION public.is_instructor_of_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_id AND c.instructor_id = public.get_user_id()
  );
$$;

-- Is current user a student enrolled in a given course?
CREATE OR REPLACE FUNCTION public.student_enrolled_in_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrolments e
    WHERE e.course_id = course_id
      AND e.student_id = public.get_user_id()
      AND e.status = 'active'
  );
$$;

-- Is current user a verified parent of the given student?
CREATE OR REPLACE FUNCTION public.is_verified_parent_of(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_child_links pcl
    WHERE pcl.parent_user_id = public.get_user_id()
      AND pcl.student_user_id = p_student_id
      AND pcl.is_verified = true
      AND pcl.is_active = true
      AND pcl.consent_given = true
  );
$$;

-- Shorthand role checks
CREATE OR REPLACE FUNCTION public.user_is_student()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT public.user_has_role('student'); $$;

CREATE OR REPLACE FUNCTION public.user_is_instructor()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT public.user_has_role('instructor'); $$;

CREATE OR REPLACE FUNCTION public.user_is_parent()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT public.user_has_role('parent'); $$;

CREATE OR REPLACE FUNCTION public.user_is_treasurer()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT public.user_has_role('treasurer'); $$;

CREATE OR REPLACE FUNCTION public.user_is_sponsor()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT public.user_has_role('sponsorship'); $$;


-- ================================================
-- CORE TABLES: Enable RLS + Policies
-- ================================================

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_service_all ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY users_own_read ON public.users FOR SELECT USING (id = public.get_user_id());
CREATE POLICY users_admin_all ON public.users FOR ALL USING (public.is_admin_or_owner());

-- Roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_service_all ON public.roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY roles_auth_read ON public.roles FOR SELECT USING (auth.role() = 'authenticated');

-- Role Assignments
ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ra_service_all ON public.role_assignments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY ra_admin_all ON public.role_assignments FOR ALL USING (public.is_admin_or_owner());

-- Organisations
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
CREATE POLICY orgs_service_all ON public.organisations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY orgs_auth_read ON public.organisations FOR SELECT USING (auth.role() = 'authenticated');

-- Programmes
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY progs_service_all ON public.programmes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY progs_admin_all ON public.programmes FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY progs_auth_read ON public.programmes FOR SELECT USING (auth.role() = 'authenticated');

-- Courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_service_all ON public.courses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY courses_admin_all ON public.courses FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY courses_instructor_read ON public.courses FOR SELECT USING (public.user_is_instructor() AND instructor_id = public.get_user_id());
CREATE POLICY courses_student_read ON public.courses FOR SELECT USING (public.user_is_student() AND public.student_enrolled_in_course(id));
CREATE POLICY courses_parent_read ON public.courses FOR SELECT USING (public.user_is_parent() AND EXISTS (
  SELECT 1 FROM public.enrolments e WHERE e.course_id = id AND e.status = 'active' AND public.is_verified_parent_of(e.student_id)
));
CREATE POLICY courses_sponsor_read ON public.courses FOR SELECT USING (public.user_is_sponsor() AND public.user_in_org(organisation_id) AND is_published = true);

-- Enrolments
ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrolments_service_all ON public.enrolments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY enrolments_admin_all ON public.enrolments FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY enrolments_student_read ON public.enrolments FOR SELECT USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY enrolments_instructor_read ON public.enrolments FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY enrolments_parent_read ON public.enrolments FOR SELECT USING (public.user_is_parent() AND public.is_verified_parent_of(student_id));

-- Lessons
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY lessons_service_all ON public.lessons FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY lessons_admin_all ON public.lessons FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY lessons_instructor_manage ON public.lessons FOR ALL USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY lessons_student_read ON public.lessons FOR SELECT USING (public.user_is_student() AND public.student_enrolled_in_course(course_id));

-- Parent-Child Links
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcl_service_all ON public.parent_child_links FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY pcl_parent_read ON public.parent_child_links FOR SELECT USING (public.user_is_parent() AND parent_user_id = public.get_user_id());
CREATE POLICY pcl_admin_read ON public.parent_child_links FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY pcl_student_read ON public.parent_child_links FOR SELECT USING (public.user_is_student() AND student_user_id = public.get_user_id());

-- Audit Events
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_service_all ON public.audit_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY audit_admin_read ON public.audit_events FOR SELECT USING (public.is_admin_or_owner());

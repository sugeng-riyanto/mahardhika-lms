-- ================================================
-- AKADEMI — COMPLETE RLS (idempotent, single file)
-- Run this ONCE after Django migrate has created all tables.
-- Re-running is safe (uses CREATE OR REPLACE / IF NOT EXISTS).
-- ================================================

-- ================================================
-- 1. Missing shorthand functions (005 was partial)
-- ================================================
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
-- 2. Enable RLS on all tables (no-op if already on)
-- ================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'pg_%' AND tablename NOT LIKE 'django_%' AND tablename NOT LIKE 'auth_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ================================================
-- 3. Policies — one section per table, IF NOT EXISTS via exception
-- ================================================

-- Helper to create policy idempotently
CREATE OR REPLACE FUNCTION public._create_policy_if_needed(pol_name TEXT, tbl TEXT, cmd TEXT, qual TEXT, chk TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname=pol_name AND tablename=tbl AND schemaname='public') THEN
    IF chk IS NULL THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s)', pol_name, tbl, cmd, qual);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s WITH CHECK (%s) USING (%s)', pol_name, tbl, cmd, chk, qual);
    END IF;
  END IF;
END $$;

-- ---- USERS ----
SELECT public._create_policy_if_needed('u_svc',   'users', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('u_own',   'users', 'SELECT', 'id = public.get_user_id()');
SELECT public._create_policy_if_needed('u_admin', 'users', 'ALL', 'public.is_admin_or_owner()');

-- ---- ROLES ----
SELECT public._create_policy_if_needed('r_svc',   'roles', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('r_auth',  'roles', 'SELECT', 'auth.role() = ''authenticated''');

-- ---- ROLE ASSIGNMENTS ----
SELECT public._create_policy_if_needed('ra_svc',   'role_assignments', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ra_admin', 'role_assignments', 'ALL', 'public.is_admin_or_owner()');

-- ---- ORGANISATIONS ----
SELECT public._create_policy_if_needed('o_svc',   'organisations', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('o_auth',  'organisations', 'SELECT', 'auth.role() = ''authenticated''');

-- ---- PROGRAMMES ----
SELECT public._create_policy_if_needed('p_svc',   'programmes', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('p_admin', 'programmes', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('p_auth',  'programmes', 'SELECT', 'auth.role() = ''authenticated''');

-- ---- COURSES ----
SELECT public._create_policy_if_needed('c_svc',   'courses', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('c_admin', 'courses', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('c_inst',  'courses', 'SELECT', 'public.user_is_instructor() AND instructor_id = public.get_user_id()');
SELECT public._create_policy_if_needed('c_stud',  'courses', 'SELECT', 'public.user_is_student() AND public.student_enrolled_in_course(id)');
SELECT public._create_policy_if_needed('c_par',   'courses', 'SELECT', 'public.user_is_parent() AND EXISTS (SELECT 1 FROM public.enrolments e WHERE e.course_id = id AND e.status = ''active'' AND public.is_verified_parent_of(e.student_id))');
SELECT public._create_policy_if_needed('c_spo',   'courses', 'SELECT', 'public.user_is_sponsor() AND public.user_in_org(organisation_id) AND is_published = true');

-- ---- ENROLMENTS ----
SELECT public._create_policy_if_needed('e_svc',   'enrolments', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('e_admin', 'enrolments', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('e_stud',  'enrolments', 'SELECT', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('e_inst',  'enrolments', 'SELECT', 'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');
SELECT public._create_policy_if_needed('e_par',   'enrolments', 'SELECT', 'public.user_is_parent() AND public.is_verified_parent_of(student_id)');

-- ---- LESSONS ----
SELECT public._create_policy_if_needed('ls_svc',   'lessons', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ls_admin', 'lessons', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('ls_inst',  'lessons', 'ALL', 'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');
SELECT public._create_policy_if_needed('ls_stud',  'lessons', 'SELECT', 'public.user_is_student() AND public.student_enrolled_in_course(course_id)');

-- ---- PARENT_CHILD_LINKS ----
SELECT public._create_policy_if_needed('pcl_svc',   'parent_child_links', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('pcl_par',   'parent_child_links', 'SELECT', 'public.user_is_parent() AND parent_user_id = public.get_user_id()');
SELECT public._create_policy_if_needed('pcl_admin', 'parent_child_links', 'SELECT', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('pcl_stud',  'parent_child_links', 'SELECT', 'public.user_is_student() AND student_user_id = public.get_user_id()');

-- ---- GRADES ----
SELECT public._create_policy_if_needed('g_svc',   'grades', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('g_admin', 'grades', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('g_inst',  'grades', 'ALL', 'public.user_is_instructor() AND public.is_instructor_of_course(activity_id)');
SELECT public._create_policy_if_needed('g_stud',  'grades', 'SELECT', 'public.user_is_student() AND student_id = public.get_user_id() AND released = true');
SELECT public._create_policy_if_needed('g_par',   'grades', 'SELECT', 'public.user_is_parent() AND released = true AND public.is_verified_parent_of(student_id)');

-- ---- ASSIGNMENTS ----
SELECT public._create_policy_if_needed('a_svc',   'assignments', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('a_admin', 'assignments', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('a_inst',  'assignments', 'ALL', 'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');
SELECT public._create_policy_if_needed('a_stud',  'assignments', 'SELECT', 'public.user_is_student() AND public.student_enrolled_in_course(course_id)');

-- ---- ASSIGNMENT_SUBMISSIONS ----
SELECT public._create_policy_if_needed('as_svc',   'assignment_submissions', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('as_stud',  'assignment_submissions', 'ALL', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('as_admin', 'assignment_submissions', 'SELECT', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('as_par',   'assignment_submissions', 'SELECT', 'public.user_is_parent() AND public.is_verified_parent_of(student_id)');

-- ---- ACTIVITY DEFINITIONS ----
SELECT public._create_policy_if_needed('ad_svc',   'activity_definitions', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ad_admin', 'activity_definitions', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('ad_inst',  'activity_definitions', 'ALL', 'public.user_is_instructor() AND public.user_in_org(organisation_id)');
SELECT public._create_policy_if_needed('ad_stud',  'activity_definitions', 'SELECT', 'public.user_is_student() AND status = ''published'' AND public.user_in_org(organisation_id)');

-- ---- ACTIVITY QUESTIONS / VERSIONS ----
SELECT public._create_policy_if_needed('aq_svc',  'activity_questions', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('aq_admin','activity_questions', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('av_svc',  'activity_versions', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('av_auth', 'activity_versions', 'SELECT', 'auth.role() = ''authenticated''');

-- ---- LESSON SCHEDULES ----
SELECT public._create_policy_if_needed('lsc_svc',   'lesson_schedules', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('lsc_admin', 'lesson_schedules', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('lsc_inst',  'lesson_schedules', 'ALL', 'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');
SELECT public._create_policy_if_needed('lsc_stud',  'lesson_schedules', 'SELECT', 'public.user_is_student() AND public.student_enrolled_in_course(course_id)');

-- ---- ATTENDANCE RECORDS ----
SELECT public._create_policy_if_needed('ar_svc',   'attendance_records', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ar_admin', 'attendance_records', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('ar_stud',  'attendance_records', 'SELECT', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('ar_par',   'attendance_records', 'SELECT', 'public.user_is_parent() AND public.is_verified_parent_of(student_id)');

-- ---- ESSAY QUESTIONS ----
SELECT public._create_policy_if_needed('eq_svc',   'essay_questions', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('eq_admin', 'essay_questions', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('eq_inst',  'essay_questions', 'ALL', 'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');

-- ---- ESSAY RESPONSES ----
SELECT public._create_policy_if_needed('er_svc',   'essay_responses', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('er_stud',  'essay_responses', 'ALL', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('er_admin', 'essay_responses', 'SELECT', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('er_par',   'essay_responses', 'SELECT', 'public.user_is_parent() AND feedback_released = true AND public.is_verified_parent_of(student_id)');

-- ---- RUBRIC ----
SELECT public._create_policy_if_needed('rc_svc',   'rubric_criteria', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('rc_admin', 'rubric_criteria', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('rc_auth',  'rubric_criteria', 'SELECT', 'auth.role() = ''authenticated''');
SELECT public._create_policy_if_needed('rl_svc',   'rubric_levels', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('rl_auth',  'rubric_levels', 'SELECT', 'auth.role() = ''authenticated''');
SELECT public._create_policy_if_needed('rs_svc',   'rubric_scores', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('rs_admin', 'rubric_scores', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('rs_stud',  'rubric_scores', 'SELECT', 'public.user_is_student() AND EXISTS (SELECT 1 FROM public.essay_responses er WHERE er.id = response_id AND er.student_id = public.get_user_id())');

-- ---- INLINE FEEDBACKS ----
SELECT public._create_policy_if_needed('ifb_svc',   'inline_feedbacks', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ifb_admin', 'inline_feedbacks', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('ifb_stud',  'inline_feedbacks', 'SELECT', 'public.user_is_student() AND is_visible_to_student = true AND EXISTS (SELECT 1 FROM public.essay_responses er WHERE er.id = response_id AND er.student_id = public.get_user_id())');

-- ---- INVOICES ----
SELECT public._create_policy_if_needed('inv_svc',       'invoices', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('inv_treasurer', 'invoices', 'ALL', 'public.user_is_treasurer()');
SELECT public._create_policy_if_needed('inv_owner',     'invoices', 'ALL', 'public.user_has_role(''owner'')');
SELECT public._create_policy_if_needed('inv_stud',      'invoices', 'SELECT', 'public.user_is_student() AND user_id = public.get_user_id()');
SELECT public._create_policy_if_needed('inv_par',       'invoices', 'SELECT', 'public.user_is_parent() AND public.is_verified_parent_of(user_id)');
SELECT public._create_policy_if_needed('inv_admin',     'invoices', 'SELECT', 'public.user_has_role(''admin'')');

-- ---- PAYMENTS ----
SELECT public._create_policy_if_needed('pi_svc',       'payment_intents', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('pi_treasurer', 'payment_intents', 'ALL', 'public.user_is_treasurer()');
SELECT public._create_policy_if_needed('pi_owner',     'payment_intents', 'ALL', 'public.user_has_role(''owner'')');
SELECT public._create_policy_if_needed('pt_svc',       'payment_transactions', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('pt_treasurer', 'payment_transactions', 'SELECT', 'public.user_is_treasurer()');
SELECT public._create_policy_if_needed('pt_owner',     'payment_transactions', 'SELECT', 'public.user_has_role(''owner'')');
SELECT public._create_policy_if_needed('prf_svc',      'payment_refunds', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('prf_treasurer','payment_refunds', 'ALL', 'public.user_is_treasurer()');
SELECT public._create_policy_if_needed('prf_owner',    'payment_refunds', 'ALL', 'public.user_has_role(''owner'')');

-- ---- NOTIFICATIONS ----
SELECT public._create_policy_if_needed('n_svc',   'notifications', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('n_own',   'notifications', 'SELECT', 'recipient_id = public.get_user_id()');
SELECT public._create_policy_if_needed('n_upd',   'notifications', 'UPDATE', 'recipient_id = public.get_user_id()');
SELECT public._create_policy_if_needed('n_admin', 'notifications', 'ALL', 'public.is_admin_or_owner()');

-- ---- CERTIFICATES ----
SELECT public._create_policy_if_needed('cert_svc',   'certificates', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('cert_admin', 'certificates', 'ALL', 'public.is_admin_or_owner()');

-- ---- PROGRESS ----
SELECT public._create_policy_if_needed('cr_svc',   'completion_records', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('cr_stud',  'completion_records', 'ALL', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('cr_admin', 'completion_records', 'SELECT', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('cp_svc',   'course_progress', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('cp_stud',  'course_progress', 'SELECT', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('cp_admin', 'course_progress', 'SELECT', 'public.is_admin_or_owner()');

-- ---- CANVAS ----
SELECT public._create_policy_if_needed('cd_svc',   'canvas_documents', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('cd_stud',  'canvas_documents', 'ALL', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('cd_admin', 'canvas_documents', 'SELECT', 'public.is_admin_or_owner()');

-- ---- ATTEMPTS / RESPONSES ----
SELECT public._create_policy_if_needed('at_svc',   'attempts', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('at_stud',  'attempts', 'ALL', 'public.user_is_student() AND student_id = public.get_user_id()');
SELECT public._create_policy_if_needed('at_admin', 'attempts', 'SELECT', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('rp_svc',   'responses', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('rp_stud',  'responses', 'SELECT', 'public.user_is_student() AND EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND a.student_id = public.get_user_id())');
SELECT public._create_policy_if_needed('rp_admin', 'responses', 'SELECT', 'public.is_admin_or_owner()');

-- ---- CONTENT ----
SELECT public._create_policy_if_needed('ci_svc',   'content_items', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ci_admin', 'content_items', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('ci_inst',  'content_items', 'ALL', 'public.user_is_instructor() AND public.user_in_org(organisation_id)');
SELECT public._create_policy_if_needed('ci_stud',  'content_items', 'SELECT', 'public.user_is_student() AND status = ''published'' AND public.user_in_org(organisation_id)');

-- ---- CONSENT ----
SELECT public._create_policy_if_needed('con_svc',   'consent_records', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('con_par',   'consent_records', 'ALL', 'public.user_is_parent() AND public.is_verified_parent_of(user_id)');
SELECT public._create_policy_if_needed('con_admin', 'consent_records', 'SELECT', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('con_stud',  'consent_records', 'SELECT', 'public.user_is_student() AND user_id = public.get_user_id()');

-- ---- SPONSORSHIP ----
SELECT public._create_policy_if_needed('sp_svc',   'sponsorship_programmes', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('sp_spo',   'sponsorship_programmes', 'SELECT', 'public.user_is_sponsor() AND sponsor_user_id = public.get_user_id()');
SELECT public._create_policy_if_needed('sp_admin', 'sponsorship_programmes', 'ALL', 'public.is_admin_or_owner()');

-- ---- SAFEGUARDING ----
SELECT public._create_policy_if_needed('sg_svc',   'safeguarding_reports', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('sg_admin', 'safeguarding_reports', 'ALL', 'public.is_admin_or_owner()');

-- ---- AUDIT EVENTS ----
SELECT public._create_policy_if_needed('ae_svc',   'audit_events', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('ae_admin', 'audit_events', 'SELECT', 'public.is_admin_or_owner()');

-- ---- PROFILES ----
SELECT public._create_policy_if_needed('prf_svc',   'profiles', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('prf_own',   'profiles', 'SELECT', 'id = public.get_user_id()');
SELECT public._create_policy_if_needed('prf_admin', 'profiles', 'ALL', 'public.is_admin_or_owner()');

-- ---- THIRD_PARTY_GRANTS ----
SELECT public._create_policy_if_needed('tpg_svc',   'third_party_grants', 'ALL', 'auth.role() = ''service_role''');
SELECT public._create_policy_if_needed('tpg_admin', 'third_party_grants', 'ALL', 'public.is_admin_or_owner()');

-- Clean up helper
DROP FUNCTION IF EXISTS public._create_policy_if_needed(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Done
DO $$ BEGIN RAISE NOTICE 'AKADEXI RLS: all policies created'; END $$;

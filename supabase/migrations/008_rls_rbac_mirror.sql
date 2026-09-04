-- ================================================
-- AKADEMI — RLS RBAC Mirror (008)
-- Updates RLS to match backend permission classes:
--   IsAcademicReadOrSponsorRole
--   IsFinanceRole
--   IsEssayRole / IsAcademicRole
--   IsThirdPartyGrantRole
--   IsGradeRole
--   IsPaymentRole
--
-- Run AFTER 007_rls_complete.sql
-- Idempotent: uses DROP POLICY IF EXISTS + CREATE POLICY IF NOT EXISTS
-- ================================================

-- ================================================
-- 0. Setup: recreate helper functions
-- ================================================
CREATE OR REPLACE FUNCTION public.user_is_third_party()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT public.user_has_role('third_party'); $$;

-- Recreate helper (007 drops it)
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

-- ================================================
-- 1. PROGRAMMES — mirror IsAcademicReadOrSponsorRole
--    Backend: owner/admin/instructor=full, student/parent=read-only, sponsor=read-only, treasurer/third_party=denied
--    Old: p_auth allowed ALL authenticated to SELECT (too broad)
-- ================================================

-- Drop the overly-broad programme SELECT policy
DROP POLICY IF EXISTS p_auth ON public.programmes;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('p_admin', 'programmes', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access (org-scoped)
SELECT public._create_policy_if_needed('p_inst', 'programmes', 'ALL',
  'public.user_is_instructor() AND public.user_in_org(organisation_id)');

-- Student: read-only (org-scoped)
SELECT public._create_policy_if_needed('p_stud', 'programmes', 'SELECT',
  'public.user_is_student() AND public.user_in_org(organisation_id)');

-- Parent: read-only (org-scoped)
SELECT public._create_policy_if_needed('p_par', 'programmes', 'SELECT',
  'public.user_is_parent() AND public.user_in_org(organisation_id)');

-- Sponsor: read-only (org-scoped, active only)
SELECT public._create_policy_if_needed('p_spo', 'programmes', 'SELECT',
  'public.user_is_sponsor() AND public.user_in_org(organisation_id) AND is_active = true');

-- Treasurer: DENIED (no policy = no access)
-- Third Party: DENIED (no policy = no access)


-- ================================================
-- 2. COURSES — mirror IsAcademicReadOrSponsorRole
--    Backend: owner/admin=full, instructor=full (own), student/parent=read-only, sponsor=read-only
-- ================================================

-- Drop old course policies to rebuild
DROP POLICY IF EXISTS c_admin ON public.courses;
DROP POLICY IF EXISTS c_inst ON public.courses;
DROP POLICY IF EXISTS c_stud ON public.courses;
DROP POLICY IF EXISTS c_par ON public.courses;
DROP POLICY IF EXISTS c_spo ON public.courses;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('c_admin', 'courses', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access to own courses
SELECT public._create_policy_if_needed('c_inst', 'courses', 'ALL',
  'public.user_is_instructor() AND public.is_instructor_of_course(id)');

-- Student: read-only (enrolled courses)
SELECT public._create_policy_if_needed('c_stud', 'courses', 'SELECT',
  'public.user_is_student() AND public.student_enrolled_in_course(id)');

-- Parent: read-only (child's enrolled courses)
SELECT public._create_policy_if_needed('c_par', 'courses', 'SELECT',
  'public.user_is_parent() AND EXISTS (SELECT 1 FROM public.enrolments e WHERE e.course_id = id AND e.status = ''active'' AND public.is_verified_parent_of(e.student_id))');

-- Sponsor: read-only (published, org-scoped)
SELECT public._create_policy_if_needed('c_spo', 'courses', 'SELECT',
  'public.user_is_sponsor() AND public.user_in_org(organisation_id) AND is_published = true');

-- Treasurer: DENIED
-- Third Party: DENIED


-- ================================================
-- 3. GRADES — mirror IsGradeRole (IsAcademicRole)
--    Backend: owner/admin=full, instructor=full (own courses), student=own released, parent=child released
--    Treasurer/sponsor/third_party: DENIED
-- ================================================

DROP POLICY IF EXISTS g_admin ON public.grades;
DROP POLICY IF EXISTS g_inst ON public.grades;
DROP POLICY IF EXISTS g_stud ON public.grades;
DROP POLICY IF EXISTS g_par ON public.grades;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('g_admin', 'grades', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access (own organisation via activity lookup)
-- grades.activity_id -> activity_definitions (no direct course_id);
-- backend scopes instructors by activity__organisation
SELECT public._create_policy_if_needed('g_inst', 'grades', 'ALL',
  'public.user_is_instructor() AND EXISTS (SELECT 1 FROM public.activity_definitions ad WHERE ad.id = activity_id AND public.user_in_org(ad.organisation_id))');

-- Student: own released grades only
SELECT public._create_policy_if_needed('g_stud', 'grades', 'SELECT',
  'public.user_is_student() AND student_id = public.get_user_id() AND released = true');

-- Parent: child's released grades only
SELECT public._create_policy_if_needed('g_par', 'grades', 'SELECT',
  'public.user_is_parent() AND released = true AND public.is_verified_parent_of(student_id)');

-- Treasurer: DENIED
-- Sponsor: DENIED
-- Third Party: DENIED


-- ================================================
-- 4. FINANCE / INVOICES — mirror IsFinanceRole
--    Backend: owner/treasurer=full, admin=read-only
--    Instructor/student/parent/sponsor/third_party: DENIED
-- ================================================

DROP POLICY IF EXISTS inv_treasurer ON public.invoices;
DROP POLICY IF EXISTS inv_owner ON public.invoices;
DROP POLICY IF EXISTS inv_stud ON public.invoices;
DROP POLICY IF EXISTS inv_par ON public.invoices;
DROP POLICY IF EXISTS inv_admin ON public.invoices;

-- Admin/Owner: full CRUD (owner manages, admin operational support)
SELECT public._create_policy_if_needed('inv_admin', 'invoices', 'ALL', 'public.is_admin_or_owner()');

-- Treasurer: full CRUD
SELECT public._create_policy_if_needed('inv_treasurer', 'invoices', 'ALL', 'public.user_is_treasurer()');

-- Student: DENIED
-- Parent: DENIED
-- Instructor: DENIED
-- Sponsor: DENIED
-- Third Party: DENIED


-- ================================================
-- 5. PAYMENTS — mirror IsFinanceRole + IsPaymentRole
--    Backend: owner/treasurer=full, admin=read-only
--    Student/parent: DENIED (invoices only)
-- ================================================

DROP POLICY IF EXISTS pi_treasurer ON public.payment_intents;
DROP POLICY IF EXISTS pi_owner ON public.payment_intents;
DROP POLICY IF EXISTS pt_treasurer ON public.payment_transactions;
DROP POLICY IF EXISTS pt_owner ON public.payment_transactions;
DROP POLICY IF EXISTS prf_treasurer ON public.payment_refunds;
DROP POLICY IF EXISTS prf_owner ON public.payment_refunds;

-- Admin/Owner: full access to payment tables
SELECT public._create_policy_if_needed('pi_admin', 'payment_intents', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('pt_admin', 'payment_transactions', 'ALL', 'public.is_admin_or_owner()');
SELECT public._create_policy_if_needed('prf_admin', 'payment_refunds', 'ALL', 'public.is_admin_or_owner()');

-- Treasurer: full access
SELECT public._create_policy_if_needed('pi_treasurer', 'payment_intents', 'ALL', 'public.user_is_treasurer()');
SELECT public._create_policy_if_needed('pt_treasurer', 'payment_transactions', 'ALL', 'public.user_is_treasurer()');
SELECT public._create_policy_if_needed('prf_treasurer', 'payment_refunds', 'ALL', 'public.user_is_treasurer()');

-- Student: own invoice payments only (read)
SELECT public._create_policy_if_needed('pi_stud', 'payment_intents', 'SELECT',
  'public.user_is_student() AND user_id = public.get_user_id()');
SELECT public._create_policy_if_needed('pt_stud', 'payment_transactions', 'SELECT',
  'public.user_is_student() AND EXISTS (SELECT 1 FROM public.payment_intents pi WHERE pi.id = payment_intent_id AND pi.user_id = public.get_user_id())');

-- Parent: child invoice payments only (read)
SELECT public._create_policy_if_needed('pi_par', 'payment_intents', 'SELECT',
  'public.user_is_parent() AND public.is_verified_parent_of(user_id)');
SELECT public._create_policy_if_needed('pt_par', 'payment_transactions', 'SELECT',
  'public.user_is_parent() AND EXISTS (SELECT 1 FROM public.payment_intents pi WHERE pi.id = payment_intent_id AND public.is_verified_parent_of(pi.user_id))');


-- ================================================
-- 6. ESSAYS — mirror IsEssayRole (IsAcademicRole)
--    Backend: owner/admin/instructor=full, student=submit own, parent=released only
--    Treasurer/sponsor/third_party: DENIED
-- ================================================

DROP POLICY IF EXISTS eq_admin ON public.essay_questions;
DROP POLICY IF EXISTS eq_inst ON public.essay_questions;
DROP POLICY IF EXISTS er_stud ON public.essay_responses;
DROP POLICY IF EXISTS er_admin ON public.essay_responses;
DROP POLICY IF EXISTS er_par ON public.essay_responses;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('eq_admin', 'essay_questions', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access (own courses)
SELECT public._create_policy_if_needed('eq_inst', 'essay_questions', 'ALL',
  'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');

-- Student: read-only (enrolled courses)
SELECT public._create_policy_if_needed('eq_stud', 'essay_questions', 'SELECT',
  'public.user_is_student() AND public.student_enrolled_in_course(course_id)');

-- Student: submit own responses
SELECT public._create_policy_if_needed('er_stud', 'essay_responses', 'ALL',
  'public.user_is_student() AND student_id = public.get_user_id()');

-- Admin: read all responses
SELECT public._create_policy_if_needed('er_admin', 'essay_responses', 'SELECT', 'public.is_admin_or_owner()');

-- Instructor: read responses for own courses
SELECT public._create_policy_if_needed('er_inst', 'essay_responses', 'SELECT',
  'public.user_is_instructor() AND EXISTS (SELECT 1 FROM public.essay_questions eq WHERE eq.id = question_id AND public.is_instructor_of_course(eq.course_id))');

-- Parent: read released feedback only
SELECT public._create_policy_if_needed('er_par', 'essay_responses', 'SELECT',
  'public.user_is_parent() AND feedback_released = true AND public.is_verified_parent_of(student_id)');

-- Treasurer: DENIED
-- Sponsor: DENIED
-- Third Party: DENIED


-- ================================================
-- 7. ASSIGNMENTS — mirror IsAssignmentRole (IsAcademicRole)
--    Backend: owner/admin/instructor=full, student=submit own, parent=read-only
--    Treasurer/sponsor/third_party: DENIED
-- ================================================

DROP POLICY IF EXISTS a_admin ON public.assignments;
DROP POLICY IF EXISTS a_inst ON public.assignments;
DROP POLICY IF EXISTS a_stud ON public.assignments;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('a_admin', 'assignments', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access (own courses)
SELECT public._create_policy_if_needed('a_inst', 'assignments', 'ALL',
  'public.user_is_instructor() AND public.is_instructor_of_course(course_id)');

-- Student: read-only (enrolled courses)
SELECT public._create_policy_if_needed('a_stud', 'assignments', 'SELECT',
  'public.user_is_student() AND public.student_enrolled_in_course(course_id)');

-- Parent: read-only (child's enrolled courses)
SELECT public._create_policy_if_needed('a_par', 'assignments', 'SELECT',
  'public.user_is_parent() AND EXISTS (SELECT 1 FROM public.enrolments e WHERE e.course_id = assignments.course_id AND e.status = ''active'' AND public.is_verified_parent_of(e.student_id))');


-- ================================================
-- 8. CONTENT — mirror IsAcademicRole
--    Backend: owner/admin/instructor=full, student=published only
--    Treasurer/sponsor/third_party: DENIED
-- ================================================

DROP POLICY IF EXISTS ci_admin ON public.content_items;
DROP POLICY IF EXISTS ci_inst ON public.content_items;
DROP POLICY IF EXISTS ci_stud ON public.content_items;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('ci_admin', 'content_items', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access (org-scoped)
SELECT public._create_policy_if_needed('ci_inst', 'content_items', 'ALL',
  'public.user_is_instructor() AND public.user_in_org(organisation_id)');

-- Student: published only (org-scoped)
SELECT public._create_policy_if_needed('ci_stud', 'content_items', 'SELECT',
  'public.user_is_student() AND status = ''published'' AND public.user_in_org(organisation_id)');


-- ================================================
-- 9. THIRD PARTY GRANTS — mirror IsThirdPartyGrantRole
--    Backend: admin/owner=full, third_party=read-only own grants
-- ================================================

DROP POLICY IF EXISTS tpg_admin ON public.third_party_grants;
DROP POLICY IF EXISTS tpg_svc ON public.third_party_grants;

-- Service role: full access
SELECT public._create_policy_if_needed('tpg_svc', 'third_party_grants', 'ALL', 'auth.role() = ''service_role''');

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('tpg_admin', 'third_party_grants', 'ALL', 'public.is_admin_or_owner()');

-- Third Party: read-only own grants (active, non-expired)
SELECT public._create_policy_if_needed('tpg_read', 'third_party_grants', 'SELECT',
  'public.user_is_third_party() AND third_party_user_id = public.get_user_id() AND is_active = true AND (valid_until IS NULL OR valid_until > now())');


-- ================================================
-- 10. ATTENDANCE — mirror IsAcademicRole
--     Backend: owner/admin/instructor=full, student=own records
-- ================================================

DROP POLICY IF EXISTS ar_admin ON public.attendance_records;
DROP POLICY IF EXISTS ar_inst ON public.attendance_records;
DROP POLICY IF EXISTS ar_stud ON public.attendance_records;
DROP POLICY IF EXISTS ar_par ON public.attendance_records;

-- Admin/Owner: full CRUD
SELECT public._create_policy_if_needed('ar_admin', 'attendance_records', 'ALL', 'public.is_admin_or_owner()');

-- Instructor: full access (own courses via schedule)
SELECT public._create_policy_if_needed('ar_inst', 'attendance_records', 'ALL',
  'public.user_is_instructor() AND EXISTS (SELECT 1 FROM public.lesson_schedules ls WHERE ls.id = schedule_id AND public.is_instructor_of_course(ls.course_id))');

-- Student: own records only
SELECT public._create_policy_if_needed('ar_stud', 'attendance_records', 'SELECT',
  'public.user_is_student() AND student_id = public.get_user_id()');

-- Parent: child's records only
SELECT public._create_policy_if_needed('ar_par', 'attendance_records', 'SELECT',
  'public.user_is_parent() AND public.is_verified_parent_of(student_id)');


-- ================================================
-- 11. NOTIFICATIONS — user-scoped (all roles)
--     Backend: user-scoped (recipient only)
-- ================================================

DROP POLICY IF EXISTS n_own ON public.notifications;
DROP POLICY IF EXISTS n_upd ON public.notifications;
DROP POLICY IF EXISTS n_admin ON public.notifications;

-- Own notifications: SELECT + UPDATE (mark read)
SELECT public._create_policy_if_needed('n_own', 'notifications', 'SELECT',
  'recipient_id = public.get_user_id()');
SELECT public._create_policy_if_needed('n_upd', 'notifications', 'UPDATE',
  'recipient_id = public.get_user_id()');

-- Admin/Owner: full access
SELECT public._create_policy_if_needed('n_admin', 'notifications', 'ALL', 'public.is_admin_or_owner()');


-- ================================================
-- 12. SAFEGUARDING — admin/owner only
-- ================================================

DROP POLICY IF EXISTS sg_admin ON public.safeguarding_reports;

SELECT public._create_policy_if_needed('sg_admin', 'safeguarding_reports', 'ALL', 'public.is_admin_or_owner()');


-- ================================================
-- 13. AUDIT EVENTS — admin/owner read-only
-- ================================================

DROP POLICY IF EXISTS ae_admin ON public.audit_events;

SELECT public._create_policy_if_needed('ae_admin', 'audit_events', 'SELECT', 'public.is_admin_or_owner()');


-- ================================================
-- 14. CONSENT — parent manages, student reads own
-- ================================================

DROP POLICY IF EXISTS con_par ON public.consent_records;
DROP POLICY IF EXISTS con_admin ON public.consent_records;
DROP POLICY IF EXISTS con_stud ON public.consent_records;

-- Parent: full access (own child's consent)
SELECT public._create_policy_if_needed('con_par', 'consent_records', 'ALL',
  'public.user_is_parent() AND public.is_verified_parent_of(user_id)');

-- Admin: read-only
SELECT public._create_policy_if_needed('con_admin', 'consent_records', 'SELECT', 'public.is_admin_or_owner()');

-- Student: read-only (own consent)
SELECT public._create_policy_if_needed('con_stud', 'consent_records', 'SELECT',
  'public.user_is_student() AND user_id = public.get_user_id()');


-- Clean up helper
DROP FUNCTION IF EXISTS public._create_policy_if_needed(TEXT, TEXT, TEXT, TEXT, TEXT);

-- ================================================
-- Summary
-- ================================================
DO $$ BEGIN RAISE NOTICE 'AKADEMI RLS 008: RBAC mirror policies applied'; END $$;

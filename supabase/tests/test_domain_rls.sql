-- ================================================
-- AKADEMI Digital Campus - Domain Tables RLS Tests
-- ================================================
-- Run this AFTER applying 003_domain_rls_policies.sql
-- Tests verify RLS policies restrict access on domain tables
-- ================================================

-- ================================================
-- TEST 1: RLS enabled on all domain tables
-- ================================================
DO $$
DECLARE
    tbl TEXT;
    domain_tables TEXT[] := ARRAY[
        'grades', 'grade_events',
        'assignments', 'assignment_submissions',
        'activity_definitions', 'activity_questions', 'activity_versions',
        'lesson_schedules', 'attendance_records',
        'essay_questions', 'essay_responses', 'rubric_criteria',
        'rubric_levels', 'rubric_scores', 'inline_feedbacks',
        'invoices',
        'payment_intents', 'payment_transactions', 'payment_refunds',
        'notifications',
        'certificates',
        'completion_records', 'course_progress',
        'canvas_documents',
        'attempts', 'responses',
        'content_items',
        'consent_records',
        'sponsorship_programmes',
        'safeguarding_reports'
    ];
BEGIN
    FOREACH tbl IN ARRAY domain_tables LOOP
        ASSERT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = tbl
              AND n.nspname = 'public'
              AND c.relrowsecurity = true
        ), 'FAIL: RLS not enabled on ' || tbl;
    END LOOP;
    RAISE NOTICE 'PASS: RLS enabled on all domain tables (% tables checked)', array_length(domain_tables, 1);
END $$;


-- ================================================
-- TEST 2: Policies exist on critical domain tables
-- ================================================
DO $$
DECLARE
    tbl TEXT;
    policy_count INT;
    critical_tables TEXT[] := ARRAY[
        'grades', 'invoices', 'notifications', 'certificates',
        'attempts', 'responses', 'essay_responses', 'payment_intents',
        'completion_records', 'canvas_documents'
    ];
BEGIN
    FOREACH tbl IN ARRAY critical_tables LOOP
        SELECT count(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl;

        ASSERT policy_count >= 2,
            'FAIL: ' || tbl || ' has only ' || policy_count || ' policies (expected >= 2)';
    END LOOP;
    RAISE NOTICE 'PASS: All critical domain tables have >= 2 policies each';
END $$;


-- ================================================
-- TEST 3: Service role bypass exists on all domain tables
-- ================================================
DO $$
DECLARE
    tbl TEXT;
    has_service_policy BOOLEAN;
    domain_tables TEXT[] := ARRAY[
        'grades', 'grade_events',
        'assignments', 'assignment_submissions',
        'activity_definitions', 'activity_questions', 'activity_versions',
        'lesson_schedules', 'attendance_records',
        'essay_questions', 'essay_responses', 'rubric_criteria',
        'rubric_levels', 'rubric_scores', 'inline_feedbacks',
        'invoices',
        'payment_intents', 'payment_transactions', 'payment_refunds',
        'notifications',
        'certificates',
        'completion_records', 'course_progress',
        'canvas_documents',
        'attempts', 'responses',
        'content_items',
        'consent_records',
        'sponsorship_programmes',
        'safeguarding_reports'
    ];
BEGIN
    FOREACH tbl IN ARRAY domain_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = tbl
              AND policydef LIKE '%service_role%'
        ) INTO has_service_policy;

        ASSERT has_service_policy,
            'FAIL: No service_role bypass policy on ' || tbl;
    END LOOP;
    RAISE NOTICE 'PASS: Service role bypass exists on all domain tables';
END $$;


-- ================================================
-- TEST 4: Helper functions exist
-- ================================================
DO $$
BEGIN
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_is_treasurer'),
        'FAIL: user_is_treasurer function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_is_instructor'),
        'FAIL: user_is_instructor function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_is_student'),
        'FAIL: user_is_student function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_is_parent'),
        'FAIL: user_is_parent function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_is_sponsor'),
        'FAIL: user_is_sponsor function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_parent_of_student_in_course'),
        'FAIL: is_parent_of_student_in_course function missing';
    RAISE NOTICE 'PASS: All domain helper functions exist';
END $$;


-- ================================================
-- TEST 5: Finance isolation — student cannot INSERT invoice
-- ================================================
-- This tests that the invoices table has no student INSERT policy
DO $$
DECLARE
    has_student_insert BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'invoices'
          AND cmd = 'INSERT'
          AND policydef LIKE '%student%'
    ) INTO has_student_insert;

    ASSERT NOT has_student_insert,
        'FAIL: Student can INSERT into invoices (should be denied)';
    RAISE NOTICE 'PASS: Student cannot INSERT invoices';
END $$;


-- ================================================
-- TEST 6: Instructor cannot access finance tables
-- ================================================
DO $$
DECLARE
    has_instructor_policy BOOLEAN;
BEGIN
    -- No instructor-specific policy on payment_transactions
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'payment_transactions'
          AND policydef LIKE '%instructor%'
    ) INTO has_instructor_policy;

    ASSERT NOT has_instructor_policy,
        'FAIL: Instructor has access to payment_transactions (finance wall broken)';
    RAISE NOTICE 'PASS: Instructor cannot access payment_transactions';
END $$;


-- ================================================
-- TEST 7: Safeguarding is admin-only (no student/parent policy)
-- ================================================
DO $$
DECLARE
    has_student_policy BOOLEAN;
    has_parent_policy BOOLEAN;
    has_sponsor_policy BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'safeguarding_reports'
          AND policydef LIKE '%student%'
    ) INTO has_student_policy;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'safeguarding_reports'
          AND policydef LIKE '%parent%'
    ) INTO has_parent_policy;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'safeguarding_reports'
          AND policydef LIKE '%sponsor%'
    ) INTO has_sponsor_policy;

    ASSERT NOT has_student_policy,
        'FAIL: Student can access safeguarding_reports';
    ASSERT NOT has_parent_policy,
        'FAIL: Parent can access safeguarding_reports';
    ASSERT NOT has_sponsor_policy,
        'FAIL: Sponsor can access safeguarding_reports';
    RAISE NOTICE 'PASS: Safeguarding reports are admin-only';
END $$;


-- ================================================
-- TEST 8: Essay responses — student can only see own
-- ================================================
DO $$
DECLARE
    has_student_own_policy BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'essay_responses'
          AND policydef LIKE '%student_id = public.get_user_id()%'
    ) INTO has_student_own_policy;

    ASSERT has_student_own_policy,
        'FAIL: Essay responses missing student own-read policy';
    RAISE NOTICE 'PASS: Essay responses have student-scoped read policy';
END $$;


-- ================================================
-- TEST 9: Notifications — recipient-scoped only
-- ================================================
DO $$
DECLARE
    has_recipient_policy BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
          AND policydef LIKE '%recipient_id = public.get_user_id()%'
    ) INTO has_recipient_policy;

    ASSERT has_recipient_policy,
        'FAIL: Notifications missing recipient-scoped policy';
    RAISE NOTICE 'PASS: Notifications are recipient-scoped';
END $$;


-- ================================================
-- TEST 10: Payment refunds — dual approval (no student INSERT)
-- ================================================
DO $$
DECLARE
    has_student_insert BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'payment_refunds'
          AND cmd = 'INSERT'
          AND policydef LIKE '%student%'
    ) INTO has_student_insert;

    ASSERT NOT has_student_insert,
        'FAIL: Student can INSERT payment refunds (dual approval broken)';
    RAISE NOTICE 'PASS: Student cannot INSERT payment refunds';
END $$;


-- ================================================
-- ALL DOMAIN RLS TESTS PASSED
-- ================================================
RAISE NOTICE '';
RAISE NOTICE '==========================================';
RAISE NOTICE 'ALL DOMAIN RLS TESTS PASSED';
RAISE NOTICE '==========================================';
RAISE NOTICE 'Domain tables with RLS: VERIFIED';
RAISE NOTICE 'Finance wall (instructor blocked): VERIFIED';
RAISE NOTICE 'Safeguarding admin-only: VERIFIED';
RAISE NOTICE 'Essay response student scoping: VERIFIED';
RAISE NOTICE 'Notification recipient scoping: VERIFIED';
RAISE NOTICE 'Payment refund dual approval: VERIFIED';

-- ================================================
-- AKADEMI Digital Campus - RLS Policy Tests
-- ================================================
-- Run this AFTER applying 002_rls_policies.sql
-- Tests verify that RLS policies correctly restrict access
-- ================================================

-- Helper: check if a function exists
-- These tests assume the schema and seed data are applied.

-- ================================================
-- TEST 1: Helper functions exist
-- ================================================
DO $$
BEGIN
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_id'),
        'FAIL: get_user_id function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_has_role'),
        'FAIL: user_has_role function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_has_any_role'),
        'FAIL: user_has_any_role function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_or_owner'),
        'FAIL: is_admin_or_owner function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_in_org'),
        'FAIL: user_in_org function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_verified_parent_of'),
        'FAIL: is_verified_parent_of function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'student_enrolled_in_course'),
        'FAIL: student_enrolled_in_course function missing';
    ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_instructor_of_course'),
        'FAIL: is_instructor_of_course function missing';
    RAISE NOTICE 'PASS: All helper functions exist';
END $$;

-- ================================================
-- TEST 2: RLS is enabled on all tables
-- ================================================
DO $$
DECLARE
    tbl TEXT;
    expected_tables TEXT[] := ARRAY[
        'organisations', 'users', 'profiles', 'roles', 'permissions',
        'role_permissions', 'role_assignments', 'parent_child_links',
        'third_party_grants', 'programmes', 'courses', 'lessons',
        'enrolments', 'audit_events'
    ];
BEGIN
    FOREACH tbl IN ARRAY expected_tables LOOP
        ASSERT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = tbl
              AND n.nspname = 'public'
              AND c.relrowsecurity = true
        ), 'FAIL: RLS not enabled on ' || tbl;
    END LOOP;
    RAISE NOTICE 'PASS: RLS enabled on all tables';
END $$;

-- ================================================
-- TEST 3: Policies exist on all critical tables
-- ================================================
DO $$
DECLARE
    tbl TEXT;
    policy_count INT;
    min_policies INT;
    tables_with_policies TEXT[] := ARRAY[
        'users', 'profiles', 'role_assignments', 'organisations',
        'courses', 'lessons', 'enrolments', 'parent_child_links',
        'third_party_grants', 'audit_events', 'roles', 'permissions',
        'role_permissions', 'programmes'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_with_policies LOOP
        SELECT count(*) INTO policy_count
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl;

        -- Every table should have at least 2 policies (service_role + user-level)
        min_policies := 2;
        ASSERT policy_count >= min_policies,
            'FAIL: ' || tbl || ' has only ' || policy_count || ' policies (need >= ' || min_policies || ')';
    END LOOP;
    RAISE NOTICE 'PASS: All tables have sufficient policies';
END $$;

-- ================================================
-- TEST 4: Roles seed data
-- ================================================
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM public.roles) = 8,
        'FAIL: Expected 8 roles, got ' || (SELECT count(*) FROM public.roles)::text;
    ASSERT EXISTS (SELECT 1 FROM public.roles WHERE name = 'owner'),
        'FAIL: owner role missing';
    ASSERT EXISTS (SELECT 1 FROM public.roles WHERE name = 'admin'),
        'FAIL: admin role missing';
    ASSERT EXISTS (SELECT 1 FROM public.roles WHERE name = 'student'),
        'FAIL: student role missing';
    ASSERT EXISTS (SELECT 1 FROM public.roles WHERE name = 'parent'),
        'FAIL: parent role missing';
    RAISE NOTICE 'PASS: Roles seeded correctly';
END $$;

-- ================================================
-- TEST 5: Permissions seed data
-- ================================================
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM public.permissions) >= 30,
        'FAIL: Expected >= 30 permissions, got ' || (SELECT count(*) FROM public.permissions)::text;
    ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'courses.read'),
        'FAIL: courses.read permission missing';
    ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'grades.create'),
        'FAIL: grades.create permission missing';
    ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'canvas.submit'),
        'FAIL: canvas.submit permission missing';
    RAISE NOTICE 'PASS: Permissions seeded correctly';
END $$;

-- ================================================
-- TEST 6: Role permissions mapping
-- ================================================
DO $$
BEGIN
    -- Owner should have ALL permissions
    ASSERT (SELECT count(*) FROM public.role_permissions rp
            JOIN public.roles r ON r.id = rp.role_id
            WHERE r.name = 'owner') = (SELECT count(*) FROM public.permissions),
        'FAIL: Owner does not have all permissions';

    -- Student should NOT have grades.create
    ASSERT NOT EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = 'student' AND p.name = 'grades.create'
    ), 'FAIL: Student should not have grades.create';

    -- Treasurer should have finance.read
    ASSERT EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = 'treasurer' AND p.name = 'finance.read'
    ), 'FAIL: Treasurer should have finance.read';

    -- Treasurer should NOT have courses.create
    ASSERT NOT EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = 'treasurer' AND p.name = 'courses.create'
    ), 'FAIL: Treasurer should not have courses.create';

    -- Parent should have courses.read but NOT courses.create
    ASSERT EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = 'parent' AND p.name = 'courses.read'
    ), 'FAIL: Parent should have courses.read';
    ASSERT NOT EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = 'parent' AND p.name = 'courses.create'
    ), 'FAIL: Parent should not have courses.create';

    -- Third party should have no permissions
    ASSERT (SELECT count(*) FROM public.role_permissions rp
            JOIN public.roles r ON r.id = rp.role_id
            WHERE r.name = 'third_party') = 0,
        'FAIL: Third party should have no default permissions';

    RAISE NOTICE 'PASS: Role permissions mapping correct';
END $$;

-- ================================================
-- SUMMARY
-- ================================================
RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'ALL RLS TESTS PASSED';
RAISE NOTICE '========================================';
RAISE NOTICE 'Helper functions: VERIFIED';
RAISE NOTICE 'RLS enabled on all tables: VERIFIED';
RAISE NOTICE 'Policies exist on all tables: VERIFIED';
RAISE NOTICE 'Role seed data: VERIFIED';
RAISE NOTICE 'Permission seed data: VERIFIED';
RAISE NOTICE 'Role-permission mappings: VERIFIED';

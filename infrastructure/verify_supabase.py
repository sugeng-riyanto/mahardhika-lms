"""
Read-only Supabase verification script.

Checks (without modifying anything):
  1. Connection to the Supabase PostgreSQL database
  2. RLS enabled on core + domain tables
  3. RBAC helper functions exist
  4. Private storage buckets exist
  5. Auth users synced

Usage:
  python infrastructure/verify_supabase.py
  python infrastructure/verify_supabase.py --url "postgresql://..."   # override

Reads the connection string from backend/.env (DATABASE_URL or SUPABASE_DB_URL).
Never prints credentials.
"""
import os
import sys

import psycopg2

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(REPO_ROOT, 'backend', '.env')

EXPECTED_TABLES = [
    # core (from 001/002)
    'organisations', 'users', 'roles', 'role_assignments',
    'parent_child_links', 'third_party_grants',
    'programmes', 'courses', 'lessons', 'enrolments',
    'audit_events', 'consent_records',
    # domain (from 003)
    'grades', 'assignments', 'assignment_submissions',
    'activity_definitions', 'lesson_schedules', 'attendance_records',
    'essay_questions', 'essay_responses', 'invoices',
    'payment_intents', 'notifications', 'certificates',
    'completion_records', 'canvas_documents', 'attempts', 'responses',
    'content_items', 'sponsorship_programmes', 'safeguarding_reports',
]

EXPECTED_FUNCTIONS = [
    'get_user_id', 'user_has_role', 'is_admin_or_owner', 'user_in_org',
    'is_verified_parent_of', 'student_enrolled_in_course',
    'is_instructor_of_course', 'user_is_treasurer', 'user_is_instructor',
    'user_is_student', 'user_is_parent', 'user_is_sponsor',
]

EXPECTED_BUCKETS = ['content-library', 'submissions', 'canvas-exports', 'certificates']


def load_db_url():
    override = None
    for i, arg in enumerate(sys.argv):
        if arg == '--url' and i + 1 < len(sys.argv):
            override = sys.argv[i + 1]
    if override:
        return override

    if not os.path.exists(ENV_PATH):
        print(f'ERROR: {ENV_PATH} not found')
        sys.exit(1)

    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k in ('DATABASE_URL', 'SUPABASE_DB_URL') and v.startswith('postgres'):
                if '[YOUR-PASSWORD]' in v or 'placeholder' in v:
                    continue
                return v
    print('ERROR: No usable DATABASE_URL in backend/.env (placeholder or missing).')
    sys.exit(1)


def main():
    url = load_db_url()
    # Safe host display
    try:
        host = url.split('@')[1].split('/')[0].split(':')[0]
    except Exception:
        host = '(unknown)'
    print(f'Connecting to Supabase: {host} ...')

    conn = psycopg2.connect(url, connect_timeout=15)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor()

    failures = 0

    # 1. Version
    cur.execute('SELECT version()')
    print(f"\n[1] Connected. Server: {cur.fetchone()[0].split(',')[0]}")

    # 2. RLS status
    print(f'\n[2] RLS status on {len(EXPECTED_TABLES)} expected tables:')
    cur.execute(
        "SELECT tablename, rowsecurity FROM pg_tables "
        "WHERE schemaname = 'public' ORDER BY tablename"
    )
    actual = dict(cur.fetchall())
    missing, rls_off, ok = [], [], []
    for t in EXPECTED_TABLES:
        if t not in actual:
            missing.append(t)
        elif not actual[t]:
            rls_off.append(t)
        else:
            ok.append(t)
    print(f'    RLS enabled : {len(ok)}')
    if missing:
        failures += len(missing)
        print(f'    MISSING     : {", ".join(missing)}  (Django migrate not run on Supabase?)')
    if rls_off:
        failures += len(rls_off)
        print(f'    RLS OFF     : {", ".join(rls_off)}  (run migrations 002/003)')

    # 3. Policy counts on key tables
    print('\n[3] Policy counts (key tables):')
    cur.execute(
        "SELECT tablename, COUNT(*) FROM pg_policies "
        "WHERE schemaname = 'public' "
        "AND tablename = ANY(%s) GROUP BY tablename ORDER BY tablename",
        (EXPECTED_TABLES,),
    )
    for t, n in cur.fetchall():
        print(f'    {t}: {n} policies')
    cur.execute("SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'")
    print(f'    TOTAL public policies: {cur.fetchone()[0]}')

    # 4. Helper functions
    print(f'\n[4] RBAC helper functions:')
    cur.execute(
        "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND proname = ANY(%s)",
        (EXPECTED_FUNCTIONS,),
    )
    found_fns = {r[0] for r in cur.fetchall()}
    missing_fns = [f for f in EXPECTED_FUNCTIONS if f not in found_fns]
    print(f'    Found: {len(found_fns)}/{len(EXPECTED_FUNCTIONS)}')
    if missing_fns:
        failures += len(missing_fns)
        print(f'    MISSING: {", ".join(missing_fns)}  (run migrations 002/003)')

    # 5. Storage buckets
    print('\n[5] Storage buckets:')
    try:
        cur.execute("SELECT id, public FROM storage.buckets ORDER BY id")
        buckets = {r[0]: r[1] for r in cur.fetchall()}
        for b in EXPECTED_BUCKETS:
            if b not in buckets:
                failures += 1
                print(f'    MISSING: {b}  (run migration 004)')
            elif buckets[b]:
                failures += 1
                print(f'    PUBLIC (should be private!): {b}')
            else:
                print(f'    OK (private): {b}')
        extra = set(buckets) - set(EXPECTED_BUCKETS)
        if extra:
            print(f'    Other buckets present: {", ".join(sorted(extra))}')
    except psycopg2.Error as e:
        failures += 1
        print(f'    ERROR reading storage.buckets: {e.diag.message_primary}')

    # 6. Auth users
    print('\n[6] Auth users:')
    try:
        cur.execute("SELECT COUNT(*) FROM auth.users")
        n = cur.fetchone()[0]
        print(f'    {n} users in auth.users')
        cur.execute(
            "SELECT email FROM auth.users ORDER BY created_at LIMIT 12"
        )
        for (email,) in cur.fetchall():
            print(f'      - {email}')
    except psycopg2.Error as e:
        print(f'    (cannot read auth.users: {e.diag.message_primary})')

    cur.close()
    conn.close()

    print('\n' + '=' * 50)
    if failures == 0:
        print('RESULT: ALL CHECKS PASSED — Supabase is correctly configured.')
    else:
        print(f'RESULT: {failures} issue(s) found — see MISSING/OFF items above.')
    sys.exit(0 if failures == 0 else 1)


if __name__ == '__main__':
    main()

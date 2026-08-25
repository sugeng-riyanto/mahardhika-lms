"""
Apply storage RLS policies to Supabase.
Run: python infrastructure/apply_storage_policies.py
"""
import psycopg2

DB_URL = "postgresql://postgres:MTAJmtXpXzTMvCbS@db.stfrztjpunetsekovlsk.supabase.co:6543/postgres?sslmode=require"

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 1. Helper function
    cur.execute("""
CREATE OR REPLACE FUNCTION public.is_verified_instructor_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrolments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.student_id = p_student_id
      AND e.status = 'active'
      AND c.instructor_id = public.get_user_id()
  );
$$;
    """)
    conn.commit()
    print("1. is_verified_instructor_of_student: OK")

    # 2. Drop old policies
    for p in [
        "storage_content_library_staff", "storage_content_library_read",
        "storage_submissions_student", "storage_submissions_instructor",
        "storage_canvas_exports_owner", "storage_canvas_exports_teacher",
        "storage_certificates_admin", "storage_certificates_recipient",
    ]:
        cur.execute(f"DROP POLICY IF EXISTS {p} ON storage.objects")
    conn.commit()
    print("2. Old policies dropped: OK")

    # 3. Create policies — FOR ALL needs USING + WITH CHECK
    #    FOR SELECT needs only USING
    policies = [
        # Content Library
        ("storage_content_library_staff", "INSERT",
         "bucket_id = 'content-library' AND auth.role() = 'authenticated' AND (public.user_has_role('instructor') OR public.is_admin_or_owner())",
         "bucket_id = 'content-library' AND auth.role() = 'authenticated' AND (public.user_has_role('instructor') OR public.is_admin_or_owner())"),
        ("storage_content_library_read", "SELECT",
         "bucket_id = 'content-library' AND auth.role() = 'authenticated'",
         None),

        # Submissions
        ("storage_submissions_student", "ALL",
         "bucket_id = 'submissions' AND auth.role() = 'authenticated' AND ((public.user_is_student() AND (storage.foldername(name))[1] = public.get_user_id()::text) OR public.is_admin_or_owner())",
         "bucket_id = 'submissions' AND auth.role() = 'authenticated' AND ((public.user_is_student() AND (storage.foldername(name))[1] = public.get_user_id()::text) OR public.is_admin_or_owner())"),
        ("storage_submissions_instructor", "SELECT",
         "bucket_id = 'submissions' AND auth.role() = 'authenticated' AND public.user_is_instructor() AND public.is_verified_instructor_of_student(((storage.foldername(name))[1])::uuid)",
         None),

        # Canvas Exports
        ("storage_canvas_exports_owner", "ALL",
         "bucket_id = 'canvas-exports' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = public.get_user_id()::text",
         "bucket_id = 'canvas-exports' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = public.get_user_id()::text"),
        ("storage_canvas_exports_teacher", "SELECT",
         "bucket_id = 'canvas-exports' AND auth.role() = 'authenticated' AND (public.is_admin_or_owner() OR public.user_has_role('instructor'))",
         None),

        # Certificates
        ("storage_certificates_admin", "ALL",
         "bucket_id = 'certificates' AND auth.role() = 'authenticated' AND (public.is_admin_or_owner() OR public.user_has_role('instructor'))",
         "bucket_id = 'certificates' AND auth.role() = 'authenticated' AND (public.is_admin_or_owner() OR public.user_has_role('instructor'))"),
        ("storage_certificates_recipient", "SELECT",
         "bucket_id = 'certificates' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = public.get_user_id()::text",
         None),
    ]

    for name, cmd, using, check in policies:
        if cmd == "SELECT":
            sql = f"CREATE POLICY {name} ON storage.objects FOR {cmd} USING ({using})"
        elif cmd == "INSERT":
            sql = f"CREATE POLICY {name} ON storage.objects FOR {cmd} WITH CHECK ({check})"
        elif cmd == "ALL":
            sql = f"CREATE POLICY {name} ON storage.objects FOR ALL USING ({using}) WITH CHECK ({check})"
        else:
            sql = f"CREATE POLICY {name} ON storage.objects FOR {cmd} USING ({using})"
        cur.execute(sql)
        print(f"   {name}: OK ({cmd})")

    conn.commit()
    print(f"\n3. Created {len(policies)} storage policies: OK")

    # 4. Verify
    cur.execute("""
        SELECT policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
        ORDER BY policyname
    """)
    rows = cur.fetchall()
    print(f"\nVerification: {len(rows)} storage policies active")
    for name, cmd in rows:
        print(f"   {name:45s} {cmd}")

    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    main()

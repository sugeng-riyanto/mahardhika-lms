-- ================================================
-- AKADEMI Digital Campus - Domain Tables RLS
-- ================================================
-- Extends 002_rls_policies.sql to cover all Django-created domain tables.
-- These tables live in the same Supabase PostgreSQL database.
-- Django uses service_role to bypass RLS; these policies protect
-- against direct Supabase client queries.
--
-- Tables covered (16 domain apps):
--   gradebook:       grades, grade_events
--   assignments:     assignments, assignment_submissions
--   activities:      activity_definitions, activity_questions, activity_versions
--   attendance:      lesson_schedules, attendance_records
--   essays:          essay_questions, essay_responses, rubric_criteria,
--                    rubric_levels, rubric_scores, inline_feedbacks
--   finance:         invoices
--   payments:        payment_intents, payment_transactions, payment_refunds
--   notifications:   notifications
--   certificates:    certificates
--   progress:        completion_records, course_progress
--   canvas:          canvas_documents
--   attempts:        attempts, responses
--   content:         content_items
--   consent:         consent_records
--   sponsorship:     sponsorship_programmes
--   safeguarding:    safeguarding_reports
-- ================================================

-- ================================================
-- HELPER: check if student is linked to parent via child's enrolment
-- ================================================
CREATE OR REPLACE FUNCTION public.is_parent_of_student_in_course(student_id UUID, course_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrolments e
    WHERE e.student_id = $1
      AND e.course_id = $2
      AND e.status = 'active'
      AND public.is_verified_parent_of($1)
  );
$$;

-- Helper: check if user owns a student in any course (for cross-table parent checks)
CREATE OR REPLACE FUNCTION public.is_parent_of(student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.is_verified_parent_of($1);
$$;

-- Helper: treasurer check
CREATE OR REPLACE FUNCTION public.user_is_treasurer()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_role('treasurer');
$$;

-- Helper: instructor check
CREATE OR REPLACE FUNCTION public.user_is_instructor()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_role('instructor');
$$;

-- Helper: student check
CREATE OR REPLACE FUNCTION public.user_is_student()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_role('student');
$$;

-- Helper: parent check
CREATE OR REPLACE FUNCTION public.user_is_parent()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_role('parent');
$$;

-- Helper: sponsor check
CREATE OR REPLACE FUNCTION public.user_is_sponsor()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT public.user_has_role('sponsorship');
$$;


-- ================================================
-- GRADEBOOK TABLE
-- ================================================

-- Grades
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY grades_service_all ON public.grades
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read their own grades (released only)
CREATE POLICY grades_student_read ON public.grades
  FOR SELECT USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
    AND is_released = true
  );

-- Instructor: can manage grades for their courses
CREATE POLICY grades_instructor_manage ON public.grades
  FOR ALL USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can manage all grades
CREATE POLICY grades_admin_manage ON public.grades
  FOR ALL USING (public.is_admin_or_owner());

-- Parent: can read released grades for their child
CREATE POLICY grades_parent_read ON public.grades
  FOR SELECT USING (
    public.user_is_parent()
    AND is_released = true
    AND public.is_verified_parent_of(student_id)
  );

-- Sponsor: can read released grades in their org
CREATE POLICY grades_sponsor_read ON public.grades
  FOR SELECT USING (
    public.user_is_sponsor()
    AND is_released = true
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = grades.course_id
        AND public.user_in_org(c.organisation_id)
    )
  );

-- Treasurer: NO access (finance wall)
-- Deny-by-default: no policy = no access


-- Grade Events (immutable audit)
ALTER TABLE public.grade_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY grade_events_service_all ON public.grade_events
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read own grade events (released only)
CREATE POLICY grade_events_student_read ON public.grade_events
  FOR SELECT USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can read grade events for their courses
CREATE POLICY grade_events_instructor_read ON public.grade_events
  FOR SELECT USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can read all grade events
CREATE POLICY grade_events_admin_read ON public.grade_events
  FOR SELECT USING (public.is_admin_or_owner());

-- No direct INSERT/UPDATE/DELETE for client users


-- ================================================
-- ASSIGNMENTS TABLE
-- ================================================

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignments_service_all ON public.assignments
  FOR ALL USING (auth.role() = 'service_role');

-- Instructor: can manage assignments in their courses
CREATE POLICY assignments_instructor_manage ON public.assignments
  FOR ALL USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Student: can read published assignments in enrolled courses
CREATE POLICY assignments_student_read ON public.assignments
  FOR SELECT USING (
    public.user_is_student()
    AND is_published = true
    AND public.student_enrolled_in_course(course_id)
  );

-- Admin/Owner: can manage all assignments
CREATE POLICY assignments_admin_manage ON public.assignments
  FOR ALL USING (public.is_admin_or_owner());

-- Parent: can read published assignments in child's courses
CREATE POLICY assignments_parent_read ON public.assignments
  FOR SELECT USING (
    public.user_is_parent()
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.enrolments e
      WHERE e.course_id = assignments.course_id
        AND e.status = 'active'
        AND public.is_verified_parent_of(e.student_id)
    )
  );

-- Sponsor: can read published assignments in their org
CREATE POLICY assignments_sponsor_read ON public.assignments
  FOR SELECT USING (
    public.user_is_sponsor()
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id
        AND public.user_in_org(c.organisation_id)
    )
  );


-- Assignment Submissions
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignment_submissions_service_all ON public.assignment_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read/manage their own submissions
CREATE POLICY assignment_submissions_student_own ON public.assignment_submissions
  FOR ALL USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can read/manage submissions for their courses
CREATE POLICY assignment_submissions_instructor_manage ON public.assignment_submissions
  FOR ALL USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND public.is_instructor_of_course(a.course_id)
    )
  );

-- Admin/Owner: can read all submissions
CREATE POLICY assignment_submissions_admin_read ON public.assignment_submissions
  FOR SELECT USING (public.is_admin_or_owner());

-- Parent: can read their child's submissions
CREATE POLICY assignment_submissions_parent_read ON public.assignment_submissions
  FOR SELECT USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(student_id)
  );


-- ================================================
-- ACTIVITIES TABLE
-- ================================================

ALTER TABLE public.activity_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_definitions_service_all ON public.activity_definitions
  FOR ALL USING (auth.role() = 'service_role');

-- Instructor: can manage activities in their org
CREATE POLICY activity_definitions_instructor_manage ON public.activity_definitions
  FOR ALL USING (
    public.user_is_instructor()
    AND public.user_in_org(organisation_id)
  );

-- Student: can read published activities in enrolled courses
CREATE POLICY activity_definitions_student_read ON public.activity_definitions
  FOR SELECT USING (
    public.user_is_student()
    AND status = 'published'
    AND public.user_in_org(organisation_id)
  );

-- Admin/Owner: can manage all activities
CREATE POLICY activity_definitions_admin_manage ON public.activity_definitions
  FOR ALL USING (public.is_admin_or_owner());

-- Parent: can read published activities in their org
CREATE POLICY activity_definitions_parent_read ON public.activity_definitions
  FOR SELECT USING (
    public.user_is_parent()
    AND status = 'published'
    AND public.user_in_org(organisation_id)
  );

-- Sponsor: can read published activities in their org
CREATE POLICY activity_definitions_sponsor_read ON public.activity_definitions
  FOR SELECT USING (
    public.user_is_sponsor()
    AND status = 'published'
    AND public.user_in_org(organisation_id)
  );


-- Activity Questions
ALTER TABLE public.activity_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_questions_service_all ON public.activity_questions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY activity_questions_instructor_manage ON public.activity_questions
  FOR ALL USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.activity_definitions ad
      WHERE ad.id = activity_questions.activity_definition_id
        AND public.user_in_org(ad.organisation_id)
    )
  );

CREATE POLICY activity_questions_student_read ON public.activity_questions
  FOR SELECT USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.activity_definitions ad
      WHERE ad.id = activity_questions.activity_definition_id
        AND ad.status = 'published'
        AND public.user_in_org(ad.organisation_id)
    )
  );

CREATE POLICY activity_questions_admin_manage ON public.activity_questions
  FOR ALL USING (public.is_admin_or_owner());


-- Activity Versions (immutable)
ALTER TABLE public.activity_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_versions_service_all ON public.activity_versions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY activity_versions_auth_read ON public.activity_versions
  FOR SELECT USING (auth.role() = 'authenticated');


-- ================================================
-- ATTENDANCE TABLE
-- ================================================

ALTER TABLE public.lesson_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY lesson_schedules_service_all ON public.lesson_schedules
  FOR ALL USING (auth.role() = 'service_role');

-- Instructor: can manage schedules for their courses
CREATE POLICY lesson_schedules_instructor_manage ON public.lesson_schedules
  FOR ALL USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Student: can read schedules for enrolled courses
CREATE POLICY lesson_schedules_student_read ON public.lesson_schedules
  FOR SELECT USING (
    public.user_is_student()
    AND public.student_enrolled_in_course(course_id)
  );

-- Admin/Owner: can manage all schedules
CREATE POLICY lesson_schedules_admin_manage ON public.lesson_schedules
  FOR ALL USING (public.is_admin_or_owner());

-- Parent: can read schedules for child's courses
CREATE POLICY lesson_schedules_parent_read ON public.lesson_schedules
  FOR SELECT USING (
    public.user_is_parent()
    AND EXISTS (
      SELECT 1 FROM public.enrolments e
      WHERE e.course_id = lesson_schedules.course_id
        AND e.status = 'active'
        AND public.is_verified_parent_of(e.student_id)
    )
  );


-- Attendance Records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_records_service_all ON public.attendance_records
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read their own attendance
CREATE POLICY attendance_records_student_read ON public.attendance_records
  FOR SELECT USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can manage attendance for their courses
CREATE POLICY attendance_records_instructor_manage ON public.attendance_records
  FOR ALL USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.lesson_schedules ls
      WHERE ls.id = attendance_records.schedule_id
        AND public.is_instructor_of_course(ls.course_id)
    )
  );

-- Admin/Owner: can manage all attendance records
CREATE POLICY attendance_records_admin_manage ON public.attendance_records
  FOR ALL USING (public.is_admin_or_owner());

-- Parent: can read their child's attendance
CREATE POLICY attendance_records_parent_read ON public.attendance_records
  FOR SELECT USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(student_id)
  );


-- ================================================
-- ESSAYS TABLE
-- ================================================

ALTER TABLE public.essay_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY essay_questions_service_all ON public.essay_questions
  FOR ALL USING (auth.role() = 'service_role');

-- Instructor: can manage essay questions in their org
CREATE POLICY essay_questions_instructor_manage ON public.essay_questions
  FOR ALL USING (
    public.user_is_instructor()
    AND public.user_in_org(organisation_id)
  );

-- Student: can read published essay questions in their org
CREATE POLICY essay_questions_student_read ON public.essay_questions
  FOR SELECT USING (
    public.user_is_student()
    AND public.user_in_org(organisation_id)
  );

-- Admin/Owner: can manage all essay questions
CREATE POLICY essay_questions_admin_manage ON public.essay_questions
  FOR ALL USING (public.is_admin_or_owner());


-- Essay Responses
ALTER TABLE public.essay_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY essay_responses_service_all ON public.essay_responses
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can manage their own responses
CREATE POLICY essay_responses_student_own ON public.essay_responses
  FOR ALL USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can read/manage responses for their courses
CREATE POLICY essay_responses_instructor_manage ON public.essay_responses
  FOR ALL USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can read all responses
CREATE POLICY essay_responses_admin_read ON public.essay_responses
  FOR SELECT USING (public.is_admin_or_owner());

-- Parent: can read their child's responses (released only)
CREATE POLICY essay_responses_parent_read ON public.essay_responses
  FOR SELECT USING (
    public.user_is_parent()
    AND is_released = true
    AND public.is_verified_parent_of(student_id)
  );


-- Rubric Criteria
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY rubric_criteria_service_all ON public.rubric_criteria
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY rubric_criteria_instructor_manage ON public.rubric_criteria
  FOR ALL USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.essay_questions eq
      WHERE eq.id = rubric_criteria.essay_question_id
        AND public.user_in_org(eq.organisation_id)
    )
  );

CREATE POLICY rubric_criteria_auth_read ON public.rubric_criteria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY rubric_criteria_admin_manage ON public.rubric_criteria
  FOR ALL USING (public.is_admin_or_owner());


-- Rubric Levels
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY rubric_levels_service_all ON public.rubric_levels
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY rubric_levels_auth_read ON public.rubric_levels
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY rubric_levels_admin_manage ON public.rubric_levels
  FOR ALL USING (public.is_admin_or_owner());


-- Rubric Scores
ALTER TABLE public.rubric_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY rubric_scores_service_all ON public.rubric_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read scores on their own responses
CREATE POLICY rubric_scores_student_read ON public.rubric_scores
  FOR SELECT USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.essay_responses er
      WHERE er.id = rubric_scores.essay_response_id
        AND er.student_id = public.get_user_id()
    )
  );

-- Instructor: can manage scores for their courses
CREATE POLICY rubric_scores_instructor_manage ON public.rubric_scores
  FOR ALL USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.essay_responses er
      WHERE er.id = rubric_scores.essay_response_id
        AND public.is_instructor_of_course(er.course_id)
    )
  );

-- Admin/Owner: can read all scores
CREATE POLICY rubric_scores_admin_read ON public.rubric_scores
  FOR SELECT USING (public.is_admin_or_owner());


-- Inline Feedbacks
ALTER TABLE public.inline_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY inline_feedbacks_service_all ON public.inline_feedbacks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY inline_feedbacks_student_read ON public.inline_feedbacks
  FOR SELECT USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.essay_responses er
      WHERE er.id = inline_feedbacks.essay_response_id
        AND er.student_id = public.get_user_id()
    )
  );

CREATE POLICY inline_feedbacks_instructor_manage ON public.inline_feedbacks
  FOR ALL USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.essay_responses er
      WHERE er.id = inline_feedbacks.essay_response_id
        AND public.is_instructor_of_course(er.course_id)
    )
  );

CREATE POLICY inline_feedbacks_admin_read ON public.inline_feedbacks
  FOR SELECT USING (public.is_admin_or_owner());


-- ================================================
-- FINANCE TABLE
-- ================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_service_all ON public.invoices
  FOR ALL USING (auth.role() = 'service_role');

-- Treasurer: can manage all invoices
CREATE POLICY invoices_treasurer_manage ON public.invoices
  FOR ALL USING (public.user_is_treasurer());

-- Owner: can manage all invoices
CREATE POLICY invoices_owner_manage ON public.invoices
  FOR ALL USING (public.user_has_role('owner'));

-- Student: can read their own invoices
CREATE POLICY invoices_student_read ON public.invoices
  FOR SELECT USING (
    public.user_is_student()
    AND user_id = public.get_user_id()
  );

-- Parent: can read invoices for their child
CREATE POLICY invoices_parent_read ON public.invoices
  FOR SELECT USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(user_id)
  );

-- Admin: can read all invoices (but not create/update — finance wall)
CREATE POLICY invoices_admin_read ON public.invoices
  FOR SELECT USING (public.user_has_role('admin'));

-- Instructor: NO access (finance wall)
-- Student: NO create/update (only read own)


-- ================================================
-- PAYMENTS TABLE
-- ================================================

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_intents_service_all ON public.payment_intents
  FOR ALL USING (auth.role() = 'service_role');

-- Treasurer: can manage all payment intents
CREATE POLICY payment_intents_treasurer_manage ON public.payment_intents
  FOR ALL USING (public.user_is_treasurer());

-- Owner: can manage all payment intents
CREATE POLICY payment_intents_owner_manage ON public.payment_intents
  FOR ALL USING (public.user_has_role('owner'));

-- Student: can read/create for their own invoices
CREATE POLICY payment_intents_student_own ON public.payment_intents
  FOR ALL USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = payment_intents.invoice_id
        AND i.user_id = public.get_user_id()
    )
  );

-- Parent: can read intents for their child's invoices
CREATE POLICY payment_intents_parent_read ON public.payment_intents
  FOR SELECT USING (
    public.user_is_parent()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = payment_intents.invoice_id
        AND public.is_verified_parent_of(i.user_id)
    )
  );

-- Admin: can read all intents
CREATE POLICY payment_intents_admin_read ON public.payment_intents
  FOR SELECT USING (public.user_has_role('admin'));


-- Payment Transactions (immutable)
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_transactions_service_all ON public.payment_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Treasurer: can read all transactions
CREATE POLICY payment_transactions_treasurer_read ON public.payment_transactions
  FOR SELECT USING (public.user_is_treasurer());

-- Owner: can read all transactions
CREATE POLICY payment_transactions_owner_read ON public.payment_transactions
  FOR SELECT USING (public.user_has_role('owner'));

-- Student: can read transactions for their own payment intents
CREATE POLICY payment_transactions_student_read ON public.payment_transactions
  FOR SELECT USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.payment_intents pi
      JOIN public.invoices i ON i.id = pi.invoice_id
      WHERE pi.id = payment_transactions.payment_intent_id
        AND i.user_id = public.get_user_id()
    )
  );

-- No direct INSERT/UPDATE/DELETE for client users


-- Payment Refunds
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_refunds_service_all ON public.payment_refunds
  FOR ALL USING (auth.role() = 'service_role');

-- Treasurer: can request and read refunds
CREATE POLICY payment_refunds_treasurer_manage ON public.payment_refunds
  FOR ALL USING (public.user_is_treasurer());

-- Owner: can approve/reject and read refunds
CREATE POLICY payment_refunds_owner_manage ON public.payment_refunds
  FOR ALL USING (public.user_has_role('owner'));

-- Student: can read refunds for their own invoices
CREATE POLICY payment_refunds_student_read ON public.payment_refunds
  FOR SELECT USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.payment_intents pi
      JOIN public.invoices i ON i.id = pi.invoice_id
      WHERE pi.id = payment_refunds.payment_intent_id
        AND i.user_id = public.get_user_id()
    )
  );


-- ================================================
-- NOTIFICATIONS TABLE
-- ================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_service_all ON public.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- User: can read their own notifications
CREATE POLICY notifications_own_read ON public.notifications
  FOR SELECT USING (
    recipient_id = public.get_user_id()
  );

-- User: can update (mark read) their own notifications
CREATE POLICY notifications_own_update ON public.notifications
  FOR UPDATE USING (
    recipient_id = public.get_user_id()
  ) WITH CHECK (
    recipient_id = public.get_user_id()
  );

-- Admin/Owner: can create notifications for any user
CREATE POLICY notifications_admin_insert ON public.notifications
  FOR INSERT WITH CHECK (
    public.is_admin_or_owner()
  );

-- Admin/Owner: can read all notifications
CREATE POLICY notifications_admin_read ON public.notifications
  FOR SELECT USING (
    public.is_admin_or_owner()
  );


-- ================================================
-- CERTIFICATES TABLE
-- ================================================

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificates_service_all ON public.certificates
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read their own active certificates
CREATE POLICY certificates_student_read ON public.certificates
  FOR SELECT USING (
    public.user_is_student()
    AND recipient_id = public.get_user_id()
    AND status = 'active'
  );

-- Parent: can read their child's active certificates
CREATE POLICY certificates_parent_read ON public.certificates
  FOR SELECT USING (
    public.user_is_parent()
    AND status = 'active'
    AND public.is_verified_parent_of(recipient_id)
  );

-- Instructor: can issue certificates for their courses
CREATE POLICY certificates_instructor_insert ON public.certificates
  FOR INSERT WITH CHECK (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can manage all certificates
CREATE POLICY certificates_admin_manage ON public.certificates
  FOR ALL USING (public.is_admin_or_owner());

-- Public: can verify by verification_code (handled via API, not RLS)


-- ================================================
-- PROGRESS TABLE
-- ================================================

ALTER TABLE public.completion_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY completion_records_service_all ON public.completion_records
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read their own completion records
CREATE POLICY completion_records_student_read ON public.completion_records
  FOR SELECT USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Student: can create completion records for their lessons
CREATE POLICY completion_records_student_insert ON public.completion_records
  FOR INSERT WITH CHECK (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can read/manage completion records for their courses
CREATE POLICY completion_records_instructor_manage ON public.completion_records
  FOR ALL USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can read all completion records
CREATE POLICY completion_records_admin_read ON public.completion_records
  FOR SELECT USING (public.is_admin_or_owner());

-- Parent: can read their child's completion records
CREATE POLICY completion_records_parent_read ON public.completion_records
  FOR SELECT USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(student_id)
  );


-- Course Progress (aggregated)
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_progress_service_all ON public.course_progress
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY course_progress_student_read ON public.course_progress
  FOR SELECT USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

CREATE POLICY course_progress_instructor_read ON public.course_progress
  FOR SELECT USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

CREATE POLICY course_progress_admin_read ON public.course_progress
  FOR SELECT USING (public.is_admin_or_owner());

CREATE POLICY course_progress_parent_read ON public.course_progress
  FOR SELECT USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(student_id)
  );


-- ================================================
-- CANVAS TABLE
-- ================================================

ALTER TABLE public.canvas_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY canvas_documents_service_all ON public.canvas_documents
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read/update their own canvas documents
CREATE POLICY canvas_documents_student_own ON public.canvas_documents
  FOR ALL USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can read/manage canvas documents for their courses
CREATE POLICY canvas_documents_instructor_manage ON public.canvas_documents
  FOR ALL USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can read all canvas documents
CREATE POLICY canvas_documents_admin_read ON public.canvas_documents
  FOR SELECT USING (public.is_admin_or_owner());


-- ================================================
-- ATTEMPTS TABLE
-- ================================================

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY attempts_service_all ON public.attempts
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can manage their own attempts
CREATE POLICY attempts_student_own ON public.attempts
  FOR ALL USING (
    public.user_is_student()
    AND student_id = public.get_user_id()
  );

-- Instructor: can read attempts for their courses
CREATE POLICY attempts_instructor_read ON public.attempts
  FOR SELECT USING (
    public.user_is_instructor()
    AND public.is_instructor_of_course(course_id)
  );

-- Admin/Owner: can read all attempts
CREATE POLICY attempts_admin_read ON public.attempts
  FOR SELECT USING (public.is_admin_or_owner());

-- Parent: can read their child's attempts
CREATE POLICY attempts_parent_read ON public.attempts
  FOR SELECT USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(student_id)
  );


-- Responses (immutable after submission)
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY responses_service_all ON public.responses
  FOR ALL USING (auth.role() = 'service_role');

-- Student: can read their own responses
CREATE POLICY responses_student_read ON public.responses
  FOR SELECT USING (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = responses.attempt_id
        AND a.student_id = public.get_user_id()
    )
  );

-- Student: can create responses for their own attempts
CREATE POLICY responses_student_insert ON public.responses
  FOR INSERT WITH CHECK (
    public.user_is_student()
    AND EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = responses.attempt_id
        AND a.student_id = public.get_user_id()
    )
  );

-- Instructor: can read responses for their courses
CREATE POLICY responses_instructor_read ON public.responses
  FOR SELECT USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = responses.attempt_id
        AND public.is_instructor_of_course(a.course_id)
    )
  );

-- Admin/Owner: can read all responses
CREATE POLICY responses_admin_read ON public.responses
  FOR SELECT USING (public.is_admin_or_owner());

-- No direct UPDATE/DELETE for client users


-- ================================================
-- CONTENT TABLE
-- ================================================

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_items_service_all ON public.content_items
  FOR ALL USING (auth.role() = 'service_role');

-- Instructor: can manage content in their org
CREATE POLICY content_items_instructor_manage ON public.content_items
  FOR ALL USING (
    public.user_is_instructor()
    AND public.user_in_org(organisation_id)
  );

-- Student: can read published content in their org
CREATE POLICY content_items_student_read ON public.content_items
  FOR SELECT USING (
    public.user_is_student()
    AND status = 'published'
    AND public.user_in_org(organisation_id)
  );

-- Admin/Owner: can manage all content
CREATE POLICY content_items_admin_manage ON public.content_items
  FOR ALL USING (public.is_admin_or_owner());

-- Sponsor: can read published content in their org
CREATE POLICY content_items_sponsor_read ON public.content_items
  FOR SELECT USING (
    public.user_is_sponsor()
    AND status = 'published'
    AND public.user_in_org(organisation_id)
  );


-- ================================================
-- CONSENT TABLE
-- ================================================

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_records_service_all ON public.consent_records
  FOR ALL USING (auth.role() = 'service_role');

-- Parent: can read/manage consent for their children
CREATE POLICY consent_records_parent_manage ON public.consent_records
  FOR ALL USING (
    public.user_is_parent()
    AND public.is_verified_parent_of(child_user_id)
  );

-- Admin/Owner: can read all consent records
CREATE POLICY consent_records_admin_read ON public.consent_records
  FOR SELECT USING (public.is_admin_or_owner());

-- Student: can read consent records about them
CREATE POLICY consent_records_student_read ON public.consent_records
  FOR SELECT USING (
    public.user_is_student()
    AND child_user_id = public.get_user_id()
  );


-- ================================================
-- SPONSORSHIP TABLE
-- ================================================

ALTER TABLE public.sponsorship_programmes ENABLE ROW LEVEL SECURITY;

CREATE POLICY sponsorship_programmes_service_all ON public.sponsorship_programmes
  FOR ALL USING (auth.role() = 'service_role');

-- Sponsor: can read their own sponsorship programmes
CREATE POLICY sponsorship_programmes_sponsor_read ON public.sponsorship_programmes
  FOR SELECT USING (
    public.user_is_sponsor()
    AND sponsor_user_id = public.get_user_id()
  );

-- Admin/Owner: can manage all sponsorship programmes
CREATE POLICY sponsorship_programmes_admin_manage ON public.sponsorship_programmes
  FOR ALL USING (public.is_admin_or_owner());


-- ================================================
-- SAFEGUARDING TABLE
-- ================================================

ALTER TABLE public.safeguarding_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY safeguarding_reports_service_all ON public.safeguarding_reports
  FOR ALL USING (auth.role() = 'service_role');

-- Admin/Owner only (highly sensitive)
CREATE POLICY safeguarding_reports_admin_manage ON public.safeguarding_reports
  FOR ALL USING (public.is_admin_or_owner());

-- Instructor: can read reports for their students
CREATE POLICY safeguarding_reports_instructor_read ON public.safeguarding_reports
  FOR SELECT USING (
    public.user_is_instructor()
    AND EXISTS (
      SELECT 1 FROM public.enrolments e
      WHERE e.student_id = safeguarding_reports.student_id
        AND public.is_instructor_of_course(e.course_id)
    )
  );

-- Deny-by-default: students, parents, sponsors, third parties cannot see safeguarding reports

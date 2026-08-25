-- ================================================
-- AKADEMI — Domain Table RLS Policies
-- Compatible with Django-created schema
-- ================================================

-- ================================================
-- GRADES (column: released, not is_released)
-- ================================================
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY grades_svc ON public.grades FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY grades_admin ON public.grades FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY grades_instructor ON public.grades FOR ALL USING (public.user_is_instructor() AND public.is_instructor_of_course(activity_id));
CREATE POLICY grades_student ON public.grades FOR SELECT USING (public.user_is_student() AND student_id = public.get_user_id() AND released = true);
CREATE POLICY grades_parent ON public.grades FOR SELECT USING (public.user_is_parent() AND released = true AND public.is_verified_parent_of(student_id));

-- ================================================
-- ASSIGNMENTS
-- ================================================
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_svc ON public.assignments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY assignments_admin ON public.assignments FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY assignments_instructor ON public.assignments FOR ALL USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY assignments_student ON public.assignments FOR SELECT USING (public.user_is_student() AND public.student_enrolled_in_course(course_id));

-- ================================================
-- ASSIGNMENT SUBMISSIONS
-- ================================================
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_svc ON public.assignment_submissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY subs_student ON public.assignment_submissions FOR ALL USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY subs_instructor ON public.assignment_submissions FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course((SELECT course_id FROM public.assignments WHERE id = assignment_id)));
CREATE POLICY subs_admin ON public.assignment_submissions FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY subs_parent ON public.assignment_submissions FOR SELECT USING (public.user_is_parent() AND public.is_verified_parent_of(student_id));

-- ================================================
-- ACTIVITIES
-- ================================================
ALTER TABLE public.activity_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY act_svc ON public.activity_definitions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY act_admin ON public.activity_definitions FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY act_instructor ON public.activity_definitions FOR ALL USING (public.user_is_instructor() AND public.user_in_org(organisation_id));
CREATE POLICY act_student ON public.activity_definitions FOR SELECT USING (public.user_is_student() AND status = 'published' AND public.user_in_org(organisation_id));

ALTER TABLE public.activity_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY aq_svc ON public.activity_questions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY aq_admin ON public.activity_questions FOR ALL USING (public.is_admin_or_owner());

ALTER TABLE public.activity_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY av_svc ON public.activity_versions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY av_auth ON public.activity_versions FOR SELECT USING (auth.role() = 'authenticated');

-- ================================================
-- ATTENDANCE
-- ================================================
ALTER TABLE public.lesson_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY ls_svc ON public.lesson_schedules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY ls_admin ON public.lesson_schedules FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY ls_instructor ON public.lesson_schedules FOR ALL USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY ls_student ON public.lesson_schedules FOR SELECT USING (public.user_is_student() AND public.student_enrolled_in_course(course_id));

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_svc ON public.attendance_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY ar_admin ON public.attendance_records FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY ar_student ON public.attendance_records FOR SELECT USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY ar_instructor ON public.attendance_records FOR ALL USING (public.user_is_instructor() AND EXISTS (
  SELECT 1 FROM public.lesson_schedules ls WHERE ls.id = schedule_id AND public.is_instructor_of_course(ls.course_id)
));
CREATE POLICY ar_parent ON public.attendance_records FOR SELECT USING (public.user_is_parent() AND public.is_verified_parent_of(student_id));

-- ================================================
-- ESSAYS (column: feedback_released, not is_released)
-- ================================================
ALTER TABLE public.essay_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY eq_svc ON public.essay_questions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY eq_admin ON public.essay_questions FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY eq_instructor ON public.essay_questions FOR ALL USING (public.user_is_instructor() AND public.user_in_org(organisation_id));

ALTER TABLE public.essay_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY er_svc ON public.essay_responses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY er_student ON public.essay_responses FOR ALL USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY er_instructor ON public.essay_responses FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course((SELECT course_id FROM public.essay_questions WHERE id = question_id)));
CREATE POLICY er_admin ON public.essay_responses FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY er_parent ON public.essay_responses FOR SELECT USING (public.user_is_parent() AND feedback_released = true AND public.is_verified_parent_of(student_id));

ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY rc_svc ON public.rubric_criteria FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY rc_admin ON public.rubric_criteria FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY rc_auth ON public.rubric_criteria FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY rl_svc ON public.rubric_levels FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY rl_auth ON public.rubric_levels FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.rubric_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY rs_svc ON public.rubric_scores FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY rs_admin ON public.rubric_scores FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY rs_instructor ON public.rubric_scores FOR ALL USING (public.user_is_instructor() AND public.is_instructor_of_course((SELECT course_id FROM public.essay_responses er JOIN public.essay_questions eq ON eq.id = er.question_id WHERE er.id = response_id)));
CREATE POLICY rs_student ON public.rubric_scores FOR SELECT USING (public.user_is_student() AND EXISTS (
  SELECT 1 FROM public.essay_responses er WHERE er.id = response_id AND er.student_id = public.get_user_id()
));

ALTER TABLE public.inline_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY if_svc ON public.inline_feedbacks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY if_admin ON public.inline_feedbacks FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY if_instructor ON public.inline_feedbacks FOR ALL USING (public.user_is_instructor() AND public.is_instructor_of_course((SELECT course_id FROM public.essay_responses er JOIN public.essay_questions eq ON eq.id = er.question_id WHERE er.id = response_id)));
CREATE POLICY if_student ON public.inline_feedbacks FOR SELECT USING (public.user_is_student() AND is_visible_to_student = true AND EXISTS (
  SELECT 1 FROM public.essay_responses er WHERE er.id = response_id AND er.student_id = public.get_user_id()
));

-- ================================================
-- FINANCE
-- ================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_svc ON public.invoices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY inv_treasurer ON public.invoices FOR ALL USING (public.user_is_treasurer());
CREATE POLICY inv_owner ON public.invoices FOR ALL USING (public.user_has_role('owner'));
CREATE POLICY inv_student ON public.invoices FOR SELECT USING (public.user_is_student() AND user_id = public.get_user_id());
CREATE POLICY inv_parent ON public.invoices FOR SELECT USING (public.user_is_parent() AND public.is_verified_parent_of(user_id));
CREATE POLICY inv_admin_read ON public.invoices FOR SELECT USING (public.user_has_role('admin'));

-- ================================================
-- PAYMENTS
-- ================================================
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pi_svc ON public.payment_intents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY pi_treasurer ON public.payment_intents FOR ALL USING (public.user_is_treasurer());
CREATE POLICY pi_owner ON public.payment_intents FOR ALL USING (public.user_has_role('owner'));
CREATE POLICY pi_student ON public.payment_intents FOR ALL USING (public.user_is_student() AND EXISTS (
  SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = public.get_user_id()
));

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_svc ON public.payment_transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY pt_treasurer ON public.payment_transactions FOR SELECT USING (public.user_is_treasurer());
CREATE POLICY pt_owner ON public.payment_transactions FOR SELECT USING (public.user_has_role('owner'));

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY prf_svc ON public.payment_refunds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY prf_treasurer ON public.payment_refunds FOR ALL USING (public.user_is_treasurer());
CREATE POLICY prf_owner ON public.payment_refunds FOR ALL USING (public.user_has_role('owner'));

-- ================================================
-- NOTIFICATIONS
-- ================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_svc ON public.notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY notif_own_read ON public.notifications FOR SELECT USING (recipient_id = public.get_user_id());
CREATE POLICY notif_own_update ON public.notifications FOR UPDATE USING (recipient_id = public.get_user_id()) WITH CHECK (recipient_id = public.get_user_id());
CREATE POLICY notif_admin ON public.notifications FOR ALL USING (public.is_admin_or_owner());

-- ================================================
-- CERTIFICATES
-- ================================================
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_svc ON public.certificates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY cert_admin ON public.certificates FOR ALL USING (public.is_admin_or_owner());

-- ================================================
-- PROGRESS
-- ================================================
ALTER TABLE public.completion_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_svc ON public.completion_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY cr_student ON public.completion_records FOR ALL USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY cr_instructor ON public.completion_records FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY cr_admin ON public.completion_records FOR SELECT USING (public.is_admin_or_owner());

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_svc ON public.course_progress FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY cp_student ON public.course_progress FOR SELECT USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY cp_instructor ON public.course_progress FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY cp_admin ON public.course_progress FOR SELECT USING (public.is_admin_or_owner());

-- ================================================
-- CANVAS
-- ================================================
ALTER TABLE public.canvas_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY cd_svc ON public.canvas_documents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY cd_student ON public.canvas_documents FOR ALL USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY cd_instructor ON public.canvas_documents FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY cd_admin ON public.canvas_documents FOR SELECT USING (public.is_admin_or_owner());

-- ================================================
-- ATTEMPTS / RESPONSES
-- ================================================
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_svc ON public.attempts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY att_student ON public.attempts FOR ALL USING (public.user_is_student() AND student_id = public.get_user_id());
CREATE POLICY att_instructor ON public.attempts FOR SELECT USING (public.user_is_instructor() AND public.is_instructor_of_course(course_id));
CREATE POLICY att_admin ON public.attempts FOR SELECT USING (public.is_admin_or_owner());

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY resp_svc ON public.responses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY resp_student ON public.responses FOR SELECT USING (public.user_is_student() AND EXISTS (
  SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND a.student_id = public.get_user_id()
));
CREATE POLICY resp_instructor ON public.responses FOR SELECT USING (public.user_is_instructor() AND EXISTS (
  SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND public.is_instructor_of_course(a.course_id)
));
CREATE POLICY resp_admin ON public.responses FOR SELECT USING (public.is_admin_or_owner());

-- ================================================
-- CONTENT
-- ================================================
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ci_svc ON public.content_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY ci_admin ON public.content_items FOR ALL USING (public.is_admin_or_owner());
CREATE POLICY ci_instructor ON public.content_items FOR ALL USING (public.user_is_instructor() AND public.user_in_org(organisation_id));
CREATE POLICY ci_student ON public.content_items FOR SELECT USING (public.user_is_student() AND status = 'published' AND public.user_in_org(organisation_id));

-- ================================================
-- CONSENT
-- ================================================
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY con_svc ON public.consent_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY con_parent ON public.consent_records FOR ALL USING (public.user_is_parent() AND public.is_verified_parent_of(user_id));
CREATE POLICY con_admin ON public.consent_records FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY con_student ON public.consent_records FOR SELECT USING (public.user_is_student() AND user_id = public.get_user_id());

-- ================================================
-- SPONSORSHIP
-- ================================================
ALTER TABLE public.sponsorship_programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_svc ON public.sponsorship_programmes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sp_sponsor ON public.sponsorship_programmes FOR SELECT USING (public.user_is_sponsor() AND sponsor_user_id = public.get_user_id());
CREATE POLICY sp_admin ON public.sponsorship_programmes FOR ALL USING (public.is_admin_or_owner());

-- ================================================
-- SAFEGUARDING
-- ================================================
ALTER TABLE public.safeguarding_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY sg_svc ON public.safeguarding_reports FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sg_admin ON public.safeguarding_reports FOR ALL USING (public.is_admin_or_owner());

export type UserRole =
  | 'owner'
  | 'admin'
  | 'treasurer'
  | 'instructor'
  | 'student'
  | 'parent'
  | 'sponsorship'
  | 'third_party';

export type RoleAssignmentStatus = 'active' | 'revoked' | 'expired';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  preferred_language: 'en' | 'id';
  created_at: string;
  updated_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  type: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: UserRole;
  display_name: string;
  description: string;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
  created_at: string;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  role: Role;
  scope_type: string | null;
  scope_id: string | null;
  organisation_id: string;
  status: RoleAssignmentStatus;
  valid_from: string;
  valid_until: string | null;
  approver_id: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentChildLink {
  id: string;
  parent_user_id: string;
  student_user_id: string;
  relationship_type: string;
  is_verified: boolean;
  is_active: boolean;
  consent_given: boolean;
  consent_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User;
  profile: Profile | null;
  role_assignments: RoleAssignment[];
  organisation: Organisation | null;
}

export interface ApiError {
  detail: string;
  code?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Programme {
  id: string;
  organisation_id: string;
  name: string;
  slug: string;
  description: string | null;
  level: 'jhs' | 'shs' | 'pkbm' | 'academy' | 'steam' | 'arts' | 'ielts' | 'teacher_dev';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  programme_id: string;
  organisation_id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor_id: string | null;
  is_published: boolean;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order: number;
  content_type: 'text' | 'video' | 'activity' | 'essay';
  content_data: Record<string, unknown>;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  scope: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Dashboard types
export interface DashboardStats {
  total_users: number;
  total_courses: number;
  total_programmes: number;
  active_enrolments: number;
  recent_audit_events: number;
}

export interface InstructorDashboardStats {
  assigned_courses: number;
  pending_submissions: number;
  published_activities: number;
  total_students: number;
}

export interface StudentDashboardStats {
  enrolled_courses: number;
  pending_assignments: number;
  completed_activities: number;
  average_grade: number;
}

export interface ParentDashboardStats {
  linked_children: number;
  children_active_courses: number;
  recent_reports: number;
}

// Essay Assessment types
export interface EssayQuestion {
  id: string;
  title: string;
  description: string;
  content_data: Record<string, unknown>;
  marks: number;
  expected_answer: string;
  learning_objectives: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'draft' | 'published' | 'archived';
  max_time_minutes: number | null;
  allow_canvas_response: boolean;
  allow_typed_response: boolean;
  allow_file_upload: boolean;
  late_submission_allowed: boolean;
  late_penalty_percent: number;
  video_url?: string;
  course: string | null;
  course_title: string | null;
  lesson: string | null;
  created_by: string;
  created_by_email: string;
  rubric_criteria: RubricCriterion[];
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface EssayResponse {
  id: string;
  question: string;
  question_title: string;
  question_marks: number;
  student: string;
  student_email: string;
  student_name: string;
  typed_answer: string;
  canvas_data: Record<string, unknown>;
  attachments: unknown[];
  status: 'draft' | 'submitted' | 'locked' | 'grading' | 'returned' | 'resubmitted' | 'finalised';
  submitted_at: string | null;
  is_late: boolean;
  version: number;
  total_score: number | null;
  percentage: number | null;
  letter_grade: string;
  overall_feedback: string;
  feedback_released: boolean;
  feedback_released_at: string | null;
  returned_at: string | null;
  return_reason: string;
  marked_by: string | null;
  marked_by_email: string | null;
  rubric_scores: RubricScore[];
  inline_feedbacks: InlineFeedback[];
  created_at: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  max_score: number;
  order: number;
  levels: RubricLevel[];
}

export interface RubricLevel {
  id: string;
  label: string;
  description: string;
  score: number;
}

export interface RubricScore {
  id: string;
  response: string;
  criterion: string;
  criterion_name: string;
  criterion_max_score: number;
  score: number;
  comment: string;
  scored_by: string | null;
  scored_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface InlineFeedback {
  id: string;
  response: string;
  anchor_type: 'text' | 'canvas' | 'general';
  text_start: number | null;
  text_end: number | null;
  selected_text: string;
  canvas_x: number | null;
  canvas_y: number | null;
  canvas_width: number | null;
  canvas_height: number | null;
  comment: string;
  is_visible_to_student: boolean;
  created_by: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

// Attendance types
export interface LessonSchedule {
  id: string;
  lesson: string;
  lesson_title: string;
  course: string;
  course_title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  is_cancelled: boolean;
  cancellation_reason: string;
  notes: string;
  attendance_count: { total: number; present: number };
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  schedule: string;
  student: string;
  student_email: string;
  student_name: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string;
  marked_by: string | null;
  marked_by_email: string | null;
  marked_at: string | null;
  lesson_title: string;
  schedule_date: string;
  course_title: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
}

// Assignment types
export interface Assignment {
  id: string;
  course: string;
  course_title: string;
  lesson: string | null;
  organisation: string;
  title: string;
  description: string;
  instructions: string;
  max_score: number;
  max_attempts: number;
  due_date: string | null;
  allow_late: boolean;
  late_penalty_percent: number;
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_by_email: string;
  allowed_file_types: string[];
  max_file_size_mb: number;
  video_url: string;
  submission_count: number;
  graded_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment: string;
  assignment_title: string;
  student: string;
  student_email: string;
  attempt_number: number;
  content_data: Record<string, unknown>;
  file_urls: string[];
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  score: number | null;
  feedback: string;
  feedback_files: string[];
  submitted_at: string | null;
  graded_at: string | null;
  graded_by: string | null;
  graded_by_email: string | null;
  created_at: string;
  updated_at: string;
}

// Activity types
export interface ActivityQuestion {
  id: string;
  activity: string;
  question_type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'image_hotspot' | 'drag_and_drop';
  title: string;
  prompt: string;
  image_url: string;
  options: { id: string; text: string; image_url?: string }[];
  correct_answer?: unknown;
  explanation?: string;
  points: number;
  order: number;
  settings: Record<string, unknown>;
}

export interface ActivityDefinition {
  id: string;
  organisation: string;
  lesson: string | null;
  title: string;
  description: string;
  activity_type: string;
  status: string;
  schema_version: number;
  time_limit_minutes: number | null;
  max_attempts: number;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  pass_mark_percentage: number;
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  grading: Record<string, unknown>;
  learning_objectives: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  questions: ActivityQuestion[];
  total_points: number;
  question_count: number;
}

export interface Attempt {
  id: string;
  student: string;
  student_email: string;
  student_name: string;
  activity: string;
  activity_title: string;
  activity_type: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'voided';
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  letter_grade: string;
  passed: boolean | null;
  duration_seconds: number | null;
  attempt_number: number;
  idempotency_key: string;
  responses: AttemptResponse[];
  created_at: string;
  updated_at: string;
}

export interface AttemptResponse {
  id: string;
  attempt: string;
  question: string;
  answer_data: Record<string, unknown>;
  score: number | null;
  max_score: number | null;
  is_correct: boolean | null;
  feedback: string;
  question_prompt?: string;
  question_type?: string;
  correct_answer?: unknown;
  explanation?: string;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
}

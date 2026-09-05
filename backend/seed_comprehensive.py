"""
Comprehensive seed data for AKADEMI Digital Campus.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from datetime import timedelta
from identity.models import User, RoleAssignment, Role
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment
from activities.models import ActivityDefinition, ActivityQuestion
from assignments.models import Assignment, AssignmentSubmission
from essays.models import EssayQuestion, EssayResponse, RubricCriterion
from gradebook.models import Grade
from certificates.models import Certificate
from progress.models import CourseProgress
from content.models import ContentItem
from notifications.models import Notification

now = timezone.now()
org = Organisation.objects.first()
if not org:
    print("ERROR: No organisation found.")
    sys.exit(1)

users = {}
for email in ['owner@mahardhika.id', 'admin@mahardhika.id', 'instructor@mahardhika.id',
              'student@mahardhika.id', 'parent@mahardhika.id', 'treasurer@mahardhika.id']:
    try:
        users[email] = User.objects.get(email=email)
    except User.DoesNotExist:
        pass

instructor = users.get('instructor@mahardhika.id')
student = users.get('student@mahardhika.id')
admin = users.get('admin@mahardhika.id')
owner = users.get('owner@mahardhika.id')

# 1. PROGRAMMES & COURSES
print("\n=== Programmes & Courses ===")
programmes = []
for name, slug, level, desc in [
    ('JHS Mathematics', 'jhs-math', 'jhs', 'Math for Grades 5-8'),
    ('SHS Physics', 'shs-physics', 'shs', 'Physics for Grades 9-12'),
    ('IELTS Preparation', 'ielts-prep', 'ielts', 'IELTS prep programme'),
    ('STEAM & Robotics', 'steam-robotics', 'steam', 'Hands-on STEAM'),
]:
    p, _ = Programme.objects.get_or_create(slug=slug, defaults={
        'name': name, 'organisation': org, 'level': level, 'description': desc, 'is_active': True,
    })
    programmes.append(p)
    print(f"  + {name}")

courses = []
for prog, title, slug, desc in [
    (programmes[0], 'Math 7A', 'math-7a', 'Algebra & geometry'),
    (programmes[0], 'Math 7B', 'math-7b', 'Statistics & probability'),
    (programmes[1], 'Physics 10 Mechanics', 'phys-10', 'Kinematics & dynamics'),
    (programmes[1], 'Physics 10 Electricity', 'phys-elec', 'Circuits & magnetism'),
    (programmes[2], 'IELTS Writing T1', 'ielts-w1', 'Academic writing'),
    (programmes[2], 'IELTS Writing T2', 'ielts-w2', 'Essay writing'),
    (programmes[3], 'Arduino Basics', 'arduino', 'Microcontrollers'),
    (programmes[3], 'Python Data Science', 'py-ds', 'Python & data'),
]:
    c, _ = Course.objects.get_or_create(slug=slug, defaults={
        'title': title, 'programme': prog, 'organisation': org,
        'description': desc, 'instructor': instructor, 'is_published': True,
    })
    courses.append(c)
    print(f"  + {title}")

# 1b. ENROLMENTS
print("\n=== Enrolments ===")
ec = 0
for course in courses[:5]:  # Enrol student in first 5 courses
    _, created = Enrolment.objects.get_or_create(
        student=student, course=course,
        defaults={'status': 'active', 'enrolled_by': instructor},
    )
    if created:
        ec += 1
        print(f"  + {student.email} -> {course.title}")
print(f"  = {ec} new enrolments")

# 2. LESSONS
print("\n=== Lessons ===")
lc = 0
for course in courses[:4]:
    for i in range(1, 6):
        _, created = Lesson.objects.get_or_create(course=course, order=i, defaults={
            'title': f'{course.title} - Lesson {i}',
            'content_type': 'text',
            'content_data': {'body': f'Lesson {i} for {course.title}'},
            'is_published': True,
        })
        if created: lc += 1
print(f"  + {lc} lessons")

# 2b. LESSON SCHEDULES (attendance slots)
print("\n=== Lesson Schedules ===")
from attendance.models import LessonSchedule
from datetime import date, timedelta
sc = 0
base_date = date.today() - timedelta(days=7)
for course in courses[:4]:
    for i, lesson in enumerate(Lesson.objects.filter(course=course).order_by('order')):
        sched_date = base_date + timedelta(days=i * 2)
        _, created = LessonSchedule.objects.get_or_create(
            lesson=lesson, date=sched_date,
            defaults={'course': course, 'start_time': '09:00', 'end_time': '10:30'},
        )
        if created: sc += 1
print(f"  + {sc} schedules")

# 3. ACTIVITIES
print("\n=== Activities ===")
ac = qc = 0
for course in courses[:4]:
    for i in range(1, 4):
        act, created = ActivityDefinition.objects.get_or_create(
            title=f'{course.title} - Activity {i}',
            organisation=org,
            defaults={
                'activity_type': ['multiple_choice', 'true_false', 'short_answer'][i % 3],
                'description': f'Activity {i} for {course.title}',
                'status': 'published',
                'created_by': instructor or admin,
            }
        )
        if created:
            ac += 1
            for qi, qd in enumerate([
                {'prompt': 'What is 2+2?', 'options': ['3', '4', '5', '6'], 'correct_answer': 'b', 'question_type': 'multiple_choice'},
                {'prompt': 'Is the sky blue?', 'options': ['Yes', 'No'], 'correct_answer': 'a', 'question_type': 'true_false'},
                {'prompt': 'Define gravity in one sentence', 'options': [], 'correct_answer': 'force', 'question_type': 'short_answer'},
            ], start=1):
                ActivityQuestion.objects.create(activity=act, order=qi, points=10, **qd)
                qc += 1
print(f"  + {ac} activities, {qc} questions")

# 4. ASSIGNMENTS
print("\n=== Assignments ===")
asc = sc = 0
for course in courses[:4]:
    for i in range(1, 4):
        a, created = Assignment.objects.get_or_create(
            title=f'{course.title} - Assignment {i}',
            course=course,
            defaults={
                'description': f'Assignment {i} for {course.title}',
                'due_date': now + timedelta(days=7 * i),
                'max_score': 100,
                'organisation': org,
                'created_by': instructor or admin,
                'status': 'published',
            }
        )
        if created:
            asc += 1
            if student and i == 1:
                sub, _ = AssignmentSubmission.objects.get_or_create(
                    assignment=a, student=student,
                    defaults={
                        'content_data': {'text': 'My submission'},
                        'status': 'submitted',
                    }
                )
                if sub: sc += 1
print(f"  + {asc} assignments, {sc} submissions")

# 5. ESSAYS
print("\n=== Essays ===")
ec = erc = 0
for course in courses[:2]:
    eq, created = EssayQuestion.objects.get_or_create(
        title=f'{course.title} - Essay',
        course=course,
        defaults={
            'description': 'Write a critical analysis',
            'marks': 100,
            'difficulty': 'medium',
            'status': 'published',
            'created_by': instructor or admin,
        }
    )
    if created:
        ec += 1
        if student:
            er, _ = EssayResponse.objects.get_or_create(
                question=eq, student=student,
                defaults={
                    'typed_answer': 'In this essay, I analyze the key concepts...',
                    'status': 'submitted',
                }
            )
            if er: erc += 1
    # Give every question a rubric (idempotent) so instructors can grade it.
    for order, (name, desc, max_score) in enumerate([
        ('Content', 'Depth and accuracy of the argument', 40),
        ('Structure', 'Organisation, flow and clarity', 30),
        ('Language', 'Grammar, vocabulary and expression', 30),
    ]):
        RubricCriterion.objects.get_or_create(
            question=eq, name=name,
            defaults={'description': desc, 'max_score': max_score, 'order': order},
        )
print(f"  + {ec} essays, {erc} responses")

# 6. GRADES (need activity FK - use existing activities)
print("\n=== Grades ===")
gc = 0
from activities.models import ActivityDefinition as ACT
for act in ACT.objects.filter(status='published')[:3]:
    if student:
        g, created = Grade.objects.get_or_create(
            student=student, activity=act,
            defaults={
                'score': 85.5,
                'max_score': 100.0,
                'released': True,
                'released_at': now - timedelta(days=1),
            }
        )
        if created: gc += 1
print(f"  + {gc} grades")

# 7. PROGRESS
print("\n=== Progress ===")
pc = 0
for course in courses[:3]:
    if student:
        p, created = CourseProgress.objects.get_or_create(
            student=student, course=course,
            defaults={
                'total_lessons': 5,
                'completed_lessons': 3,
                'total_activities': 3,
                'completed_activities': 2,
                'overall_percent': 65.0,
            }
        )
        if created: pc += 1
print(f"  + {pc} progress records")

# 8. CONTENT
print("\n=== Content Items ===")
YT_URL = 'https://www.youtube.com/watch?v=Q7twwJbocDM&t=1362s'
DRV_VIDEO = 'https://drive.google.com/file/d/1-kSKW-B3mji1aZL8ptuTew1yi5G26osj/view'
DRV_PDF = 'https://drive.google.com/file/d/1ZL2I4CiAATDwh5vVxtU2cpDwxOoegBsl/view'

REAL_CONTENT = [
    ('Algebra Fundamentals Slides', 'document', DRV_PDF, 'application/pdf'),
    ("Newton's Laws Animation", 'video', YT_URL, 'video/youtube'),
    ('Physics Lab Demonstration', 'video', DRV_VIDEO, 'video/mp4'),
    ('Periodic Table Reference', 'document', DRV_PDF, 'application/pdf'),
    ('IELTS Vocabulary Builder', 'document', DRV_PDF, 'application/pdf'),
    ('Physics 10 Kinematics Formulas', 'document', DRV_PDF, 'application/pdf'),
    ('Python Data Analysis Starter', 'document', DRV_PDF, 'application/pdf'),
    ('Arduino Circuit Tutorial', 'video', YT_URL, 'video/youtube'),
    ('IELTS Writing Task 2 Guide', 'document', DRV_PDF, 'application/pdf'),
    ('Geometry Formula Sheet', 'document', DRV_PDF, 'application/pdf'),
    ('STEAM Robotics Project Guide', 'document', DRV_PDF, 'application/pdf'),
    ('Math 7B Statistics Video Lecture', 'video', YT_URL, 'video/youtube'),
    ('Physics Electricity Lab Manual', 'document', DRV_PDF, 'application/pdf'),
    ('IELTS Writing Templates', 'document', DRV_PDF, 'application/pdf'),
    # Slides
    ('Algebra 7A Lecture Slides', 'document', DRV_PDF, 'application/pdf'),
    ('Physics 10 Electricity Slides', 'document', DRV_PDF, 'application/pdf'),
    ('IELTS Speaking Part 2 Slides', 'document', DRV_PDF, 'application/pdf'),
    # Audio
    ('Physics 10 Kinematics Audio Lecture', 'audio', DRV_VIDEO, 'audio/mpeg'),
    ('IELTS Listening Practice Test 1', 'audio', DRV_VIDEO, 'audio/mpeg'),
    ('Math 7A Algebra Audio Summary', 'audio', DRV_VIDEO, 'audio/mpeg'),
    # Image
    ('Periodic Table High-Res Poster', 'image', DRV_PDF, 'image/jpeg'),
    ('Physics 10 Electricity Diagram', 'image', DRV_PDF, 'image/jpeg'),
    ('IELTS Writing Task 2 Structure', 'image', DRV_PDF, 'image/jpeg'),
    ('Math 7A Geometry Formula Card', 'image', DRV_PDF, 'image/jpeg'),
]
cc = 0
for i, (title, ctype, url, mime) in enumerate(REAL_CONTENT):
    course = courses[i % len(courses)]
    ci, created = ContentItem.objects.get_or_create(
        title=f'{course.title} - {title}',
        organisation=org,
        defaults={
            'content_type': ctype,
            'file_url': url,
            'mime_type': mime,
            'description': f'Resource for {course.title}',
            'uploaded_by': instructor or admin,
            'status': 'published',
        }
    )
    if created: cc += 1
print(f"  + {cc} content items")

# 9. NOTIFICATIONS
print("\n=== Notifications ===")
nc = 0
for email, user in users.items():
    for i, ntype in enumerate(['grade_released', 'assignment_due', 'course_update', 'system']):
        n, created = Notification.objects.get_or_create(
            title=f'{ntype.replace("_", " ").title()} {i+1}',
            recipient=user,
            defaults={
                'message': f'Sample {ntype} notification',
                'channel': 'in_app',
                'is_read': i > 1,
            }
        )
        if created: nc += 1
print(f"  + {nc} notifications")

# SUMMARY
print("\n" + "=" * 50)
print("SEED DATA COMPLETE")
print("=" * 50)
for app_label, model_name in [
    ('courses', 'Programme'), ('courses', 'Course'), ('courses', 'Lesson'),
    ('activities', 'ActivityDefinition'), ('activities', 'ActivityQuestion'),
    ('assignments', 'Assignment'), ('assignments', 'AssignmentSubmission'),
    ('essays', 'EssayQuestion'), ('essays', 'EssayResponse'),
    ('gradebook', 'Grade'), ('progress', 'CourseProgress'),
    ('content', 'ContentItem'), ('notifications', 'Notification'),
]:
    m = django.apps.apps.get_model(app_label, model_name)
    print(f"  {model_name}: {m.objects.count()}")

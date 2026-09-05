"""
Comprehensive dummy data seeder for all RBAC roles.
Adds: content with Drive links, assignments with video briefs,
essays with video prompts, grades, finance, consent, certificates,
sponsorship, notifications, attendance records.
Run: python seed_dummy_content.py
Idempotent — re-running adds zero duplicates.
"""
import os, sys, django, hashlib
from datetime import date, timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from django.apps import apps
from identity.models import User
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment
from content.models import ContentItem
from assignments.models import Assignment, AssignmentSubmission
from essays.models import EssayQuestion, EssayResponse, RubricCriterion
from gradebook.models import Grade
from notifications.models import Notification
from attendance.models import LessonSchedule, AttendanceRecord
from activities.models import ActivityDefinition
from progress.models import CourseProgress

now = timezone.now()
today = date.today()
org = Organisation.objects.first()

# ── Users ──
users = {}
for email in ['owner@mahardhika.id', 'admin@mahardhika.id', 'instructor@mahardhika.id',
              'student@mahardhika.id', 'parent@mahardhika.id', 'treasurer@mahardhika.id',
              'sponsor@mahardhika.id', 'thirdparty@mahardhika.id']:
    try:
        users[email] = User.objects.get(email=email)
    except User.DoesNotExist:
        pass

instructor = users.get('instructor@mahardhika.id')
student = users.get('student@mahardhika.id')
parent = users.get('parent@mahardhika.id')
admin = users.get('admin@mahardhika.id')
owner = users.get('owner@mahardhika.id')
treasurer = users.get('treasurer@mahardhika.id')
sponsor = users.get('sponsor@mahardhika.id')
thirdparty = users.get('thirdparty@mahardhika.id')
courses = list(Course.objects.filter(organisation=org).order_by('created_at')[:8])

# ══════════════════════════════════════════════════════════════
# 1. CONTENT ITEMS — Google Drive PDFs + videos
# ══════════════════════════════════════════════════════════════
print("\n=== Content Items (Google Drive) ===")
DRIVE_CONTENT = [
    # (title, description, content_type, file_url, mime_type, tags)
    ("Algebra Fundamentals Slides", "Lecture slides for algebra introduction", "document",
     "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view", "application/pdf",
     ["math", "algebra", "jhs", "slides"]),
    ("Newton's Laws Animation", "Interactive animation showing Newton's three laws", "video",
     "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view", "video/mp4",
     ["physics", "newton", "forces", "animation"]),
    ("Periodic Table Reference", "High-resolution periodic table with element details", "document",
     "https://drive.google.com/file/d/1Z9Y8X7W6V5U4T3S2R1Q/view", "application/pdf",
     ["chemistry", "reference", "periodic-table"]),
    ("Geometry Formula Sheet", "Comprehensive formula reference for geometry", "document",
     "https://drive.google.com/file/d/1KLMNOPQRSTUV123456789/view", "application/pdf",
     ["math", "geometry", "formulas", "reference"]),
    ("IELTS Writing Task 2 Guide", "Complete guide for IELTS Writing Task 2", "document",
     "https://drive.google.com/file/d/1IELTSWritingGuide2026PDF/view", "application/pdf",
     ["ielts", "writing", "guide", "academic"]),
    ("Arduino Circuit Tutorial", "Step-by-step Arduino circuit building tutorial", "video",
     "https://drive.google.com/file/d/1ArduinoCircuitTutorialHD/view", "video/mp4",
     ["arduino", "electronics", "tutorial", "hands-on"]),
    ("Python Data Analysis Starter", "Introduction to pandas and data visualization", "document",
     "https://drive.google.com/file/d/1PythonDataAnalysisPDF2026/view", "application/pdf",
     ["python", "data-science", "pandas", "tutorial"]),
    ("Physics 10 Kinematics Formulas", "Key formulas for kinematics and projectile motion", "document",
     "https://drive.google.com/file/d/1KinematicsFormulasPDF/view", "application/pdf",
     ["physics", "kinematics", "formulas", "reference"]),
    ("IELTS Vocabulary Builder", "Academic word list with definitions and examples", "document",
     "https://drive.google.com/file/d/1IELTSVocabBuilderPDF/view", "application/pdf",
     ["ielts", "vocabulary", "academic-words"]),
    ("Math 7B Statistics Video Lecture", "Introduction to mean, median, and mode", "video",
     "https://drive.google.com/file/d/1Math7BStatsVideoLecture/view", "video/mp4",
     ["math", "statistics", "lecture", "mean-median-mode"]),
    ("STEAM Robotics Project Guide", "Complete guide for building a line-following robot", "document",
     "https://drive.google.com/file/d/1STEAMRoboticsProjectGuide/view", "application/pdf",
     ["steam", "robotics", "project", "guide"]),
    ("Physics Electricity Lab Manual", "Lab procedures for Ohm's Law experiments", "document",
     "https://drive.google.com/file/d/1PhysicsElectricityLabManual/view", "application/pdf",
     ["physics", "electricity", "lab", "ohms-law"]),
]

cc = 0
for title, desc, ctype, url, mime, tags in DRIVE_CONTENT:
    ci, created = ContentItem.objects.get_or_create(
        title=title, organisation=org,
        defaults={
            'description': desc,
            'content_type': ctype,
            'file_url': url,
            'mime_type': mime,
            'tags': tags,
            'uploaded_by': instructor or admin,
            'status': 'published',
        }
    )
    if created:
        cc += 1
        print(f"  + {title}")
print(f"  = {cc} new content items")

# ══════════════════════════════════════════════════════════════
# 2. ASSIGNMENTS with video briefs
# ══════════════════════════════════════════════════════════════
print("\n=== Assignments (with video briefs) ===")
VIDEO_ASSIGNMENTS = [
    ("Video Essay: Climate Change Analysis", "Analyze the documentary clip and write a response essay",
     "https://drive.google.com/file/d/1ClimateChangeDocVideo/view"),
    ("Lab Report: Ohm's Law", "Watch the experiment video and submit your lab report",
     "https://drive.google.com/file/d/1OhmsLawExperimentVideo/view"),
    ("Project Presentation: Arduino", "Record and submit your Arduino project presentation",
     "https://drive.google.com/file/d/1ArduinoProjectPresentation/view"),
    ("IELTS Task 2 Practice", "Watch the writing technique video, then complete the practice task",
     "https://drive.google.com/file/d/1IELTSTask2TechniqueVideo/view"),
]

ac = 0
for i, (title, desc, video_url) in enumerate(VIDEO_ASSIGNMENTS):
    course = courses[i % len(courses)]
    a, created = Assignment.objects.get_or_create(
        title=title, course=course,
        defaults={
            'description': desc,
            'video_url': video_url,
            'due_date': now + timedelta(days=14 + i * 7),
            'max_score': 100,
            'organisation': org,
            'created_by': instructor or admin,
            'status': 'published',
        }
    )
    if created:
        ac += 1
        # Create a student submission for the first one
        if student and i == 0:
            AssignmentSubmission.objects.get_or_create(
                assignment=a, student=student,
                defaults={
                    'content_data': {'text': 'Climate change is a critical global issue that requires immediate action...'},
                    'status': 'submitted',
                }
            )
        print(f"  + {title}")
print(f"  = {ac} new assignments with video briefs")

# ══════════════════════════════════════════════════════════════
# 3. ESSAY QUESTIONS with video prompts
# ══════════════════════════════════════════════════════════════
print("\n=== Essay Questions (with video prompts) ===")
VIDEO_ESSAYS = [
    ("Video Essay: Environmental Ethics", "Watch the documentary and write a critical analysis", 120, "medium",
     "https://drive.google.com/file/d/1EnvironmentalEthicsDoc/view"),
    ("Video Essay: Mathematics in Daily Life", "Watch the lecture clip and explain real-world applications", 100, "easy",
     "https://drive.google.com/file/d/1MathDailyLifeLecture/view"),
    ("Video Essay: Physics of Motion", "Watch the demonstration and analyze the physics principles", 150, "hard",
     "https://drive.google.com/file/d/1PhysicsMotionDemo/view"),
]

ec = 0
for title, desc, marks, diff, video_url in VIDEO_ESSAYS:
    course = courses[0]  # First course
    eq, created = EssayQuestion.objects.get_or_create(
        title=title, course=course,
        defaults={
            'description': desc,
            'marks': marks,
            'difficulty': diff,
            'video_url': video_url,
            'status': 'published',
            'created_by': instructor or admin,
        }
    )
    if created:
        ec += 1
        # Add rubric criteria
        for order, (name, rdesc, max_score) in enumerate([
            ('Content', 'Depth and accuracy of the argument', int(marks * 0.4)),
            ('Structure', 'Organisation, flow and clarity', int(marks * 0.3)),
            ('Language', 'Grammar, vocabulary and expression', int(marks * 0.3)),
        ]):
            RubricCriterion.objects.get_or_create(
                question=eq, name=name,
                defaults={'description': rdesc, 'max_score': max_score, 'order': order},
            )
        # Create a student response
        if student:
            EssayResponse.objects.get_or_create(
                question=eq, student=student,
                defaults={
                    'typed_answer': 'This essay analyzes the key concepts presented in the video...',
                    'status': 'submitted',
                }
            )
        print(f"  + {title}")
print(f"  = {ec} new essay questions with video prompts")

# ══════════════════════════════════════════════════════════════
# 4. GRADES (more released grades for student/parent)
# ══════════════════════════════════════════════════════════════
print("\n=== Grades ===")
gc = 0
# Activity-based grades
for act in ActivityDefinition.objects.filter(status='published')[:6]:
    if student:
        g, created = Grade.objects.get_or_create(
            student=student, activity=act,
            defaults={
                'score': Decimal('85.50'),
                'max_score': Decimal('100.00'),
                'released': True,
                'released_at': now - timedelta(days=2),
            }
        )
        if created:
            gc += 1

# Also create grades for more activities
for act in ActivityDefinition.objects.filter(status='published')[6:12]:
    if student:
        g, created = Grade.objects.get_or_create(
            student=student, activity=act,
            defaults={
                'score': Decimal('88.00'),
                'max_score': Decimal('100.00'),
                'released': True,
                'released_at': now - timedelta(days=1),
            }
        )
        if created:
            gc += 1
print(f"  + {gc} new grades")

# ══════════════════════════════════════════════════════════════
# 5. ATTENDANCE RECORDS (actual attendance data)
# ══════════════════════════════════════════════════════════════
print("\n=== Attendance Records ===")
arc = 0
statuses = ['present', 'present', 'present', 'late', 'absent']
schedules = LessonSchedule.objects.all()[:10]
for i, schedule in enumerate(schedules):
    if student:
        ar, created = AttendanceRecord.objects.get_or_create(
            schedule=schedule, student=student,
            defaults={
                'status': statuses[i % len(statuses)],
                'notes': f'Roll call for {schedule.lesson.title if schedule.lesson else "class"}',
            }
        )
        if created:
            arc += 1
print(f"  = {arc} new attendance records")

# ══════════════════════════════════════════════════════════════
# 6. FINANCE (invoices for treasurer)
# ══════════════════════════════════════════════════════════════
print("\n=== Finance (Invoices) ===")
from finance.models import Invoice
ic = 0
INVOICES = [
    ("INV-2026-001", Decimal("2500000"), "paid", "Tuition fee - Math 7A Term 1"),
    ("INV-2026-002", Decimal("3500000"), "paid", "Tuition fee - Physics 10 Term 1"),
    ("INV-2026-003", Decimal("2000000"), "sent", "Lab materials fee - Physics 10"),
    ("INV-2026-004", Decimal("1500000"), "overdue", "IELTS preparation materials"),
    ("INV-2026-005", Decimal("4000000"), "draft", "Tuition fee - STEAM & Robotics"),
    ("INV-2026-006", Decimal("2750000"), "paid", "Tuition fee - Math 7B Term 1"),
    ("INV-2026-007", Decimal("1800000"), "sent", "Arduino starter kit"),
]

for inv_num, amount, status, notes in INVOICES:
    if student:
        inv, created = Invoice.objects.get_or_create(
            invoice_number=inv_num, organisation=org,
            defaults={
                'user': student,
                'amount': amount,
                'currency': 'IDR',
                'status': status,
                'due_date': today + timedelta(days=30),
                'paid_at': now - timedelta(days=5) if status == 'paid' else None,
                'notes': notes,
            }
        )
        if created:
            ic += 1
            print(f"  + {inv_num}: {amount} IDR ({status})")
print(f"  = {ic} new invoices")

# ══════════════════════════════════════════════════════════════
# 7. CONSENT RECORDS (parent manages child consent)
# ══════════════════════════════════════════════════════════════
print("\n=== Consent Records ===")
from consent.models import ConsentRecord
ccr = 0
CONSENTS = [
    ("learning", "granted", "Learning data processing for academic progress tracking"),
    ("analytics", "granted", "Aggregate analytics for programme improvement"),
    ("communication", "granted", "Email and in-app notifications"),
    ("third_party", "withdrawn", "Third-party data sharing for research"),
    ("child_data", "granted", "Processing of child personal data under UU PDP"),
]

for purpose, status, processing_desc in CONSENTS:
    if student and parent:
        cr, created = ConsentRecord.objects.get_or_create(
            user=student, purpose=purpose,
            defaults={
                'consented_by': parent,
                'status': status,
                'granted': status == 'granted',
                'granted_at': now - timedelta(days=10) if status == 'granted' else None,
                'withdrawn_at': now - timedelta(days=2) if status == 'withdrawn' else None,
                'processing_purpose': processing_desc,
                'data_categories': ['name', 'email', 'grades', 'attendance'],
                'third_parties': ['Supabase', 'Email Service'],
                'retention_period_days': 1825,  # 5 years
                'lawful_basis': 'consent',
            }
        )
        if created:
            ccr += 1
            print(f"  + {purpose}: {status}")
print(f"  = {ccr} new consent records")

# ══════════════════════════════════════════════════════════════
# 8. CERTIFICATES (student completion certificates)
# ══════════════════════════════════════════════════════════════
print("\n=== Certificates ===")
from certificates.models import Certificate
certc = 0
CERTIFICATES = [
    ("Math 7A Completion", "Successfully completed Mathematics 7A with distinction"),
    ("Physics 10 Mechanics", "Successfully completed Physics 10 Mechanics"),
    ("IELTS Writing T1", "Completed IELTS Writing Task 1 preparation"),
]

for title, desc in CERTIFICATES:
    if student and courses:
        cert_num = f"CERT-{2026}-{hashlib.md5(title.encode()).hexdigest()[:6].upper()}"
        ver_code = hashlib.sha256(f"{cert_num}{title}".encode()).hexdigest()[:16]
        cert, created = Certificate.objects.get_or_create(
            certificate_number=cert_num,
            defaults={
                'recipient': student,
                'organisation': org,
                'course': courses[0],
                'title': title,
                'description': desc,
                'recipient_name': 'Student Mahardhika',
                'recipient_email': 'student@mahardhika.id',
                'issued_date': today - timedelta(days=30),
                'completion_date': today - timedelta(days=35),
                'status': 'active',
                'issued_by': instructor or admin,
                'verification_code': ver_code,
            }
        )
        if created:
            certc += 1
            print(f"  + {title} ({cert_num})")
print(f"  = {certc} new certificates")

# ══════════════════════════════════════════════════════════════
# 9. SPONSORSHIP PROGRAMMES
# ══════════════════════════════════════════════════════════════
print("\n=== Sponsorship Programmes ===")
from sponsorship.models import SponsorshipProgramme
spc = 0
SPONSORSHIPS = [
    ("Mahardhika Scholarship Fund", Decimal("50000000"), Decimal("15000000"),
     "Full scholarship for underprivileged students in STEAM programmes"),
    ("Physics Lab Equipment Fund", Decimal("25000000"), Decimal("8000000"),
     "Equipment fund for physics laboratory upgrades"),
]

for name, fund, utilised, desc in SPONSORSHIPS:
    if sponsor:
        sp, created = SponsorshipProgramme.objects.get_or_create(
            name=name, organisation=org,
            defaults={
                'sponsor_user': sponsor,
                'fund_amount': fund,
                'fund_utilised': utilised,
                'is_active': True,
            }
        )
        if created:
            spc += 1
            print(f"  + {name}: {fund} IDR")
print(f"  = {spc} new sponsorship programmes")

# ══════════════════════════════════════════════════════════════
# 10. NOTIFICATIONS (role-specific)
# ══════════════════════════════════════════════════════════════
print("\n=== Notifications ===")
nc = 0
NOTIFICATION_DATA = [
    # (recipient_email, title, message, channel, is_read)
    ("student@mahardhika.id", "Grade Released: Physics 10", "Your grade for Physics 10 Mechanics has been released. Score: 85/100", "in_app", False),
    ("student@mahardhika.id", "Assignment Due: Math 7A", "Assignment 1 for Math 7A is due in 3 days", "in_app", False),
    ("student@mahardhika.id", "New Course Content", "New video lecture added to Physics 10 Electricity", "in_app", True),
    ("student@mahardhika.id", "Certificate Issued", "Your Math 7A completion certificate has been issued", "in_app", True),
    ("instructor@mahardhika.id", "New Essay Submission", "Student submitted essay response for Environmental Ethics", "in_app", False),
    ("instructor@mahardhika.id", "Assignment Grading Due", "3 assignments pending grading", "in_app", False),
    ("instructor@mahardhika.id", "Course Published", "Physics 10 Electricity is now live", "in_app", True),
    ("parent@mahardhika.id", "Grade Released", "Your child's Physics 10 grade has been released", "in_app", False),
    ("parent@mahardhika.id", "Attendance Alert", "Your child was marked absent in Math 7A on " + str(today), "in_app", False),
    ("parent@mahardhika.id", "Consent Reminder", "Please review data processing consent for your child", "in_app", True),
    ("admin@mahardhika.id", "New User Registered", "A new instructor account has been created", "in_app", False),
    ("admin@mahardhika.id", "System Health", "All systems operating normally", "in_app", True),
    ("treasurer@mahardhika.id", "Invoice Overdue", "INV-2026-004 is now overdue", "in_app", False),
    ("treasurer@mahardhika.id", "Payment Received", "INV-2026-001 payment of 2,500,000 IDR received", "in_app", True),
    ("sponsor@mahardhika.id", "Fund Utilisation Update", "Scholarship fund utilisation is at 30%", "in_app", False),
    ("owner@mahardhika.id", "Weekly Report", "System activity summary for this week is available", "in_app", True),
    ("owner@mahardhika.id", "Safeguarding Alert", "New safeguarding report submitted", "in_app", False),
]

for email, title, message, channel, is_read in NOTIFICATION_DATA:
    user = users.get(email)
    if user:
        n, created = Notification.objects.get_or_create(
            title=title, recipient=user,
            defaults={
                'message': message,
                'channel': channel,
                'is_read': is_read,
            }
        )
        if created:
            nc += 1
print(f"  = {nc} new notifications")

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("SEED DUMMY CONTENT — COMPLETE")
print("=" * 60)
for label, name in [
    ('content', 'ContentItem'), ('assignments', 'Assignment'),
    ('assignments', 'AssignmentSubmission'), ('essays', 'EssayQuestion'),
    ('essays', 'EssayResponse'), ('essays', 'RubricCriterion'),
    ('gradebook', 'Grade'), ('attendance', 'AttendanceRecord'),
    ('finance', 'Invoice'), ('consent', 'ConsentRecord'),
    ('certificates', 'Certificate'), ('sponsorship', 'SponsorshipProgramme'),
    ('notifications', 'Notification'),
]:
    m = apps.get_model(label, name)
    print(f"  {name}: {m.objects.count()}")

print("\nAll RBAC roles now have CRUD data:")
print("  Owner:      governance overview, certificates, notifications")
print("  Admin:      user management, content, system health")
print("  Instructor: courses, assignments, essays, grading, content")
print("  Student:    enrolments, submissions, grades, attendance, certificates")
print("  Parent:     child progress, consent management, attendance alerts")
print("  Treasurer:  invoices, payments, finance overview")
print("  Sponsor:    sponsorship programmes, fund utilisation")
print("  Third Party: contracted content access")

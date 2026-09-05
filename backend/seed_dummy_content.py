"""
Supplement seed — adds data types NOT in seed_comprehensive.py:
  finance invoices, consent records, certificates,
  sponsorship programmes, attendance records.

Run AFTER seed_comprehensive.py. Idempotent.
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
from courses.models import Course
from attendance.models import LessonSchedule, AttendanceRecord

now = timezone.now()
today = date.today()
org = Organisation.objects.first()
if not org:
    print("ERROR: No organisation found. Run seed_comprehensive.py first.")
    sys.exit(1)

# Resolve users
users = {}
for email in ['owner@', 'admin@', 'instructor@', 'student@', 'parent@',
              'treasurer@', 'sponsor@', 'thirdparty@']:
    full = email + 'mahardhika.id'
    try:
        users[email] = User.objects.get(email=full)
    except User.DoesNotExist:
        pass

student = users.get('student@')
parent = users.get('parent@')
instructor = users.get('instructor@')
admin = users.get('admin@')
treasurer = users.get('treasurer@')
sponsor = users.get('sponsor@')

# ── 1. FINANCE ──────────────────────────────────────────────
print("\n=== Finance ===")
from finance.models import Invoice
ic = 0
for num, amount, status, note in [
    ("INV-2026-001", Decimal("2500000"), "paid", "Tuition fee - Math 7A Term 1"),
    ("INV-2026-002", Decimal("3500000"), "paid", "Tuition fee - Physics 10 Term 1"),
    ("INV-2026-003", Decimal("2000000"), "sent", "Lab materials fee"),
    ("INV-2026-004", Decimal("1500000"), "overdue", "IELTS preparation materials"),
    ("INV-2026-005", Decimal("4000000"), "draft", "Tuition fee - STEAM"),
    ("INV-2026-006", Decimal("2750000"), "paid", "Tuition fee - Math 7B"),
    ("INV-2026-007", Decimal("1800000"), "sent", "Arduino starter kit"),
]:
    if student:
        _, created = Invoice.objects.get_or_create(
            invoice_number=num, organisation=org,
            defaults={'user': student, 'amount': amount, 'currency': 'IDR',
                      'status': status, 'due_date': today + timedelta(days=30),
                      'paid_at': now - timedelta(days=5) if status == 'paid' else None,
                      'notes': note})
        if created: ic += 1
print(f"  {ic} invoices")

# ── 2. CONSENT ──────────────────────────────────────────────
print("\n=== Consent ===")
from consent.models import ConsentRecord
cc = 0
for purpose, status, desc in [
    ("learning", "granted", "Learning data processing for academic progress"),
    ("analytics", "granted", "Aggregate analytics for programme improvement"),
    ("communication", "granted", "Email and in-app notifications"),
    ("third_party", "withdrawn", "Third-party data sharing for research"),
    ("child_data", "granted", "Processing child personal data under UU PDP"),
]:
    if student and parent:
        _, created = ConsentRecord.objects.get_or_create(
            user=student, purpose=purpose,
            defaults={'consented_by': parent, 'status': status,
                      'granted': status == 'granted',
                      'granted_at': now - timedelta(days=10) if status == 'granted' else None,
                      'withdrawn_at': now - timedelta(days=2) if status == 'withdrawn' else None,
                      'processing_purpose': desc,
                      'data_categories': ['name', 'email', 'grades', 'attendance'],
                      'retention_period_days': 1825, 'lawful_basis': 'consent'})
        if created: cc += 1
print(f"  {cc} consent records")

# ── 3. CERTIFICATES ─────────────────────────────────────────
print("\n=== Certificates ===")
from certificates.models import Certificate
certc = 0
for title, desc in [
    ("Math 7A Completion", "Completed Mathematics 7A with distinction"),
    ("Physics 10 Mechanics", "Completed Physics 10 Mechanics"),
    ("IELTS Writing T1", "Completed IELTS Writing Task 1 preparation"),
]:
    if student:
        cert_num = f"CERT-2026-{hashlib.md5(title.encode()).hexdigest()[:6].upper()}"
        ver = hashlib.sha256(f"{cert_num}{title}".encode()).hexdigest()[:16]
        _, created = Certificate.objects.get_or_create(
            certificate_number=cert_num,
            defaults={'recipient': student, 'organisation': org,
                      'course': Course.objects.filter(organisation=org).first(),
                      'title': title, 'description': desc,
                      'recipient_name': 'Student Mahardhika',
                      'recipient_email': 'student@mahardhika.id',
                      'issued_date': today - timedelta(days=30),
                      'status': 'active', 'issued_by': instructor or admin,
                      'verification_code': ver})
        if created: certc += 1
print(f"  {certc} certificates")

# ── 4. SPONSORSHIP ──────────────────────────────────────────
print("\n=== Sponsorship ===")
from sponsorship.models import SponsorshipProgramme
spc = 0
for name, fund, utilised in [
    ("Mahardhika Scholarship Fund", Decimal("50000000"), Decimal("15000000")),
    ("Physics Lab Equipment Fund", Decimal("25000000"), Decimal("8000000")),
]:
    if sponsor:
        _, created = SponsorshipProgramme.objects.get_or_create(
            name=name, organisation=org,
            defaults={'sponsor_user': sponsor, 'fund_amount': fund,
                      'fund_utilised': utilised, 'is_active': True})
        if created: spc += 1
print(f"  {spc} sponsorship programmes")

# ── 5. ATTENDANCE RECORDS ───────────────────────────────────
print("\n=== Attendance Records ===")
arc = 0
statuses = ['present', 'present', 'present', 'late', 'absent']
for i, schedule in enumerate(LessonSchedule.objects.all()[:10]):
    if student:
        _, created = AttendanceRecord.objects.get_or_create(
            schedule=schedule, student=student,
            defaults={'status': statuses[i % len(statuses)],
                      'notes': f'Roll call'})
        if created: arc += 1
print(f"  {arc} attendance records")

# ── SUMMARY ─────────────────────────────────────────────────
print("\n" + "=" * 50)
print("SUPPLEMENT SEED COMPLETE")
print("=" * 50)
for label, name in [
    ('finance', 'Invoice'), ('consent', 'ConsentRecord'),
    ('certificates', 'Certificate'), ('sponsorship', 'SponsorshipProgramme'),
    ('attendance', 'AttendanceRecord'),
]:
    m = apps.get_model(label, name)
    print(f"  {name}: {m.objects.count()}")

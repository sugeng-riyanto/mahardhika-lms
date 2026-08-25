"""
AKA DEMI Digital Campus -- Seed Data Management Command

Seeds the complete development dataset in one command:
  - Organisation
  - 8 roles (Owner, Admin, Treasurer, Instructor, Student, Parent, Sponsor, Third Party)
  - 8 seed users with role assignments
  - Supabase Auth users (created or fetched via Admin API)
  - Django user supabase_uid linked to real Supabase auth UIDs
  - Parent-child link with consent
  - Third-party access grant
  - 5 programmes (JHS Math, SHS Physics, IELTS, STEAM, Teacher Dev)
  - 8 courses with lessons
  - Enrolments (students in courses)
  - Sample content items and activity definitions

Usage:
  python manage.py seed_data                      # Seed with defaults
  python manage.py seed_data --clear              # Clear all data first, then seed
  python manage.py seed_data --password mypass    # Use custom password
  python manage.py seed_data --skip-content       # Skip content/activity seeding
  python manage.py seed_data --skip-supabase      # Skip Supabase Auth sync
"""
import os
import json
import urllib.request
import urllib.error
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from identity.models import User, Role, RoleAssignment, ParentChildLink, ThirdPartyGrant
from organisations.models import Organisation
from courses.models import Programme, Course, Lesson, Enrolment


class Command(BaseCommand):
    help = 'Seed the database with development data for AKADEMI Digital Campus'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear', action='store_true',
            help='Clear existing seed data before seeding',
        )
        parser.add_argument(
            '--password', type=str, default='dev-password-2026',
            help='Password for all seed accounts (default: dev-password-2026)',
        )
        parser.add_argument(
            '--skip-content', action='store_true',
            help='Skip content items and activity definitions',
        )
        parser.add_argument(
            '--skip-supabase', action='store_true',
            help='Skip Supabase Auth user creation (offline mode)',
        )
        parser.add_argument(
            '--org-name', type=str, default='Mahardhika Academy',
            help='Organisation name',
        )

    def handle(self, *args, **options):
        clear = options['clear']
        password = options['password']
        skip_content = options['skip_content']
        skip_supabase = options['skip_supabase']
        org_name = options['org_name']

        self.stdout.write(self.style.WARNING(
            '\n========================================\n'
            '  AKADEMI Digital Campus -- Seed Data\n'
            '========================================\n'
        ))

        # Step 1: Sync Supabase Auth users (outside Django transaction)
        supabase_map = {}
        if not skip_supabase:
            supabase_map = self._sync_supabase_users(password)
        else:
            self.stdout.write('  Skipping Supabase Auth sync (--skip-supabase).\n')

        with transaction.atomic():
            if clear:
                self._clear_data()

            org = self._seed_organisation(org_name)
            roles = self._seed_roles()
            users = self._seed_users(password, supabase_map)
            self._seed_role_assignments(users, roles, org)
            self._seed_parent_child_link(users)
            self._seed_third_party_grant(users, org)
            programmes = self._seed_programmes(org)
            courses = self._seed_courses(programmes, users, org)
            self._seed_lessons(courses)
            self._seed_enrolments(users, courses, org)

            if not skip_content:
                self._seed_content(org, users)
                self._seed_activities(org, users)

        self.stdout.write(self.style.SUCCESS(
            '\nSeed data complete!\n\n'
            'Seed accounts (all use password: {}):\n'
            '  owner@mahardhika.id       -> Owner\n'
            '  admin@mahardhika.id       -> Administrator\n'
            '  treasurer@mahardhika.id   -> Treasurer\n'
            '  instructor@mahardhika.id  -> Instructor\n'
            '  student@mahardhika.id     -> Student\n'
            '  parent@mahardhika.id      -> Parent/Guardian\n'
            '  sponsor@mahardhika.id     -> Sponsor\n'
            '  thirdparty@mahardhika.id  -> Third Party\n'
            '\nLogin via Supabase Auth at the app login page.\n'.format(password)
        ))

    # ----------------------------------------------------------------
    # Supabase Auth sync
    # ----------------------------------------------------------------

    def _get_supabase_config(self):
        """Read Supabase URL and service_role key from environment or .env."""
        # Try environment variables first (set by dotenv or shell)
        url = os.environ.get('SUPABASE_URL', '')
        key = os.environ.get('SUPABASE_SECRET_KEY', '')

        # Fall back to reading backend/.env directly
        if not url or not key:
            env_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(
                    os.path.dirname(os.path.abspath(__file__))))),
                '.env',
            )
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('#') or '=' not in line:
                            continue
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k == 'SUPABASE_URL' and not url:
                            url = v
                        elif k == 'SUPABASE_SECRET_KEY' and not key:
                            key = v

        if not url or not key or 'placeholder' in url:
            return None, None
        return url, key

    def _supabase_admin_request(self, method, url, service_key, body=None):
        """Make an authenticated request to the Supabase Admin API."""
        headers = {
            'Authorization': f'Bearer {service_key}',
            'apikey': service_key,
            'Content-Type': 'application/json',
        }
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else ''
            self.stdout.write(self.style.ERROR(
                f'  Supabase API error {e.code}: {error_body[:200]}'
            ))
            return None
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'  Supabase API request failed: {str(e)}'
            ))
            return None

    def _sync_supabase_users(self, password):
        """Create auth users in Supabase and return {email: supabase_uid} map."""
        supabase_url, service_key = self._get_supabase_config()

        if not supabase_url:
            self.stdout.write(self.style.WARNING(
                '  Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY).\n'
                '  Skipping auth user creation. Users will be auto-created on first login.\n'
            ))
            return {}

        self.stdout.write(self.style.HTTP_INFO('\n  Syncing Supabase Auth users...'))

        # List existing auth users
        admin_url = f'{supabase_url}/auth/v1/admin/users'
        existing = self._supabase_admin_request('GET', admin_url, service_key)
        existing_users = {}
        if existing and 'users' in existing:
            for u in existing['users']:
                existing_users[u['email']] = u['id']

        self.stdout.write(f'  Found {len(existing_users)} existing auth users in Supabase.')

        # Seed user definitions
        seed_users = [
            ('owner@mahardhika.id', 'Owner Mahardhika'),
            ('admin@mahardhika.id', 'Admin Mahardhika'),
            ('treasurer@mahardhika.id', 'Treasurer Mahardhika'),
            ('instructor@mahardhika.id', 'Instructor Mahardhika'),
            ('student@mahardhika.id', 'Student Mahardhika'),
            ('parent@mahardhika.id', 'Parent Mahardhika'),
            ('sponsor@mahardhika.id', 'Sponsor Mahardhika'),
            ('thirdparty@mahardhika.id', 'Third Party Mahardhika'),
        ]

        supabase_map = {}

        for email, full_name in seed_users:
            if email in existing_users:
                supabase_map[email] = existing_users[email]
                self.stdout.write(f'  Exists:  {email} ({existing_users[email][:12]}...)')
                continue

            # Create auth user in Supabase
            create_url = f'{admin_url}'
            body = {
                'email': email,
                'password': password,
                'email_confirm': True,
                'user_metadata': {
                    'full_name': full_name,
                },
            }
            result = self._supabase_admin_request('POST', create_url, service_key, body)
            if result and 'id' in result:
                supabase_map[email] = result['id']
                self.stdout.write(self.style.SUCCESS(
                    f'  Created: {email} ({result["id"][:12]}...)'
                ))
            else:
                self.stdout.write(self.style.WARNING(
                    f'  Failed:  {email} (will auto-link on first login)'
                ))

        self.stdout.write(
            f'  Supabase sync complete: {len(supabase_map)}/{len(seed_users)} users linked.\n'
        )
        return supabase_map

    # ----------------------------------------------------------------
    # Django data seeding
    # ----------------------------------------------------------------

    def _clear_data(self):
        """Clear existing seed data (preserve migrations)."""
        self.stdout.write('Clearing existing data...')
        ThirdPartyGrant.objects.all().delete()
        ParentChildLink.objects.all().delete()
        Enrolment.objects.all().delete()
        Lesson.objects.all().delete()
        Course.objects.all().delete()
        Programme.objects.all().delete()
        RoleAssignment.objects.all().delete()
        User.objects.filter(email__endswith='@mahardhika.id').delete()
        Role.objects.all().delete()
        Organisation.objects.filter(slug='mahardhika').delete()
        self.stdout.write(self.style.SUCCESS('  Cleared.'))

    def _seed_organisation(self, name):
        """Create the main organisation."""
        org, created = Organisation.objects.get_or_create(
            slug='mahardhika',
            defaults={'name': name, 'is_active': True},
        )
        action = 'Created' if created else 'Exists'
        self.stdout.write(f'  {action}: Organisation "{org.name}"')
        return org

    def _seed_roles(self):
        """Create all 8 RBAC roles."""
        roles_data = [
            ('owner', 'Owner', 'System governance and organisation configuration'),
            ('admin', 'Administrator', 'User, programme, and operational management'),
            ('treasurer', 'Treasurer', 'Finance, invoice, reconciliation, and financial reports'),
            ('instructor', 'Instructor', 'Course, lesson, assessment, rubric, grading, and student progress'),
            ('student', 'Student', 'Learning materials, activities, submissions, and personal progress'),
            ('parent', 'Parent/Guardian', 'Child progress and communication'),
            ('sponsorship', 'Sponsor', 'Sponsorship information and limited reports'),
            ('third_party', 'Third Party', 'Time-bound, purpose-bound integration support'),
        ]

        roles = {}
        for name, display, desc in roles_data:
            role, created = Role.objects.get_or_create(
                name=name,
                defaults={'display_name': display, 'description': desc},
            )
            roles[name] = role
            action = 'Created' if created else 'Exists'
            self.stdout.write(f'  {action}: Role "{display}"')

        return roles

    def _seed_users(self, password, supabase_map):
        """Create 8 seed users, linking Supabase Auth UIDs when available."""
        users_data = [
            ('owner@mahardhika.id', 'Owner Mahardhika', 'owner'),
            ('admin@mahardhika.id', 'Admin Mahardhika', 'admin'),
            ('treasurer@mahardhika.id', 'Treasurer Mahardhika', 'treasurer'),
            ('instructor@mahardhika.id', 'Instructor Mahardhika', 'instructor'),
            ('student@mahardhika.id', 'Student Mahardhika', 'student'),
            ('parent@mahardhika.id', 'Parent Mahardhika', 'parent'),
            ('sponsor@mahardhika.id', 'Sponsor Mahardhika', 'sponsorship'),
            ('thirdparty@mahardhika.id', 'Third Party Mahardhika', 'third_party'),
        ]

        users = {}
        for email, name, role in users_data:
            # Use real Supabase UID if available, otherwise fallback
            supabase_uid = supabase_map.get(email, f'local-{email}')

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'supabase_uid': supabase_uid,
                    'full_name': name,
                    'is_active': True,
                },
            )
            # Update supabase_uid if it changed (e.g. local-* -> real UUID)
            if not created and user.supabase_uid != supabase_uid:
                old_uid = user.supabase_uid
                user.supabase_uid = supabase_uid
                user.save(update_fields=['supabase_uid', 'updated_at'])
                self.stdout.write(
                    f'  Linked:  {email} ({old_uid[:20]}... -> {supabase_uid[:12]}...)'
                )
            elif created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'  Created: User {email} ({role}) uid={supabase_uid[:12]}...'
                ))
            else:
                self.stdout.write(f'  Exists:  User {email} ({role})')

            users[role] = user

        return users

    def _seed_role_assignments(self, users, roles, org):
        """Assign each user their role in the organisation."""
        self.stdout.write('  Assigning roles...')
        count = 0
        for role_name, user in users.items():
            if role_name in roles:
                _, created = RoleAssignment.objects.get_or_create(
                    user=user,
                    role=roles[role_name],
                    organisation=org,
                    defaults={'status': 'active'},
                )
                if created:
                    count += 1
        self.stdout.write(f'  Created {count} role assignments.')

    def _seed_parent_child_link(self, users):
        """Create parent-child link with consent."""
        link, created = ParentChildLink.objects.get_or_create(
            parent_user=users['parent'],
            student_user=users['student'],
            defaults={
                'relationship_type': 'parent',
                'is_verified': True,
                'is_active': True,
                'consent_given': True,
                'consent_date': timezone.now(),
            },
        )
        action = 'Created' if created else 'Exists'
        self.stdout.write(f'  {action}: Parent-child link (parent -> student)')

    def _seed_third_party_grant(self, users, org):
        """Create a sample third-party access grant."""
        grant, created = ThirdPartyGrant.objects.get_or_create(
            third_party_user=users['third_party'],
            organisation=org,
            purpose='Data integration with partner system',
            defaults={
                'scope_type': 'organisation',
                'is_active': True,
                'valid_until': timezone.now() + timedelta(days=90),
                'granted_by': users['admin'],
            },
        )
        action = 'Created' if created else 'Exists'
        self.stdout.write(f'  {action}: Third-party grant (90-day access)')

    def _seed_programmes(self, org):
        """Create educational programmes."""
        programmes_data = [
            ('Junior High School Mathematics', 'jhs-math', 'jhs',
             'Mathematics curriculum for Grades 5-8 covering algebra, geometry, statistics, and number sense.'),
            ('Senior High School Physics', 'shs-physics', 'shs',
             'Physics curriculum for Grades 9-12 covering mechanics, thermodynamics, electromagnetism, and modern physics.'),
            ('IELTS Preparation', 'ielts-prep', 'ielts',
             'Comprehensive IELTS preparation covering listening, reading, writing, and speaking skills.'),
            ('STEAM & Robotics Camp', 'steam-robotics', 'steam',
             'Hands-on STEAM education with robotics, coding, and engineering design challenges.'),
            ('Teacher Development Programme', 'teacher-dev', 'teacher_dev',
             'Professional development for educators covering pedagogy, assessment, and educational technology.'),
        ]

        programmes = {}
        for name, slug, level, desc in programmes_data:
            prog, created = Programme.objects.get_or_create(
                organisation=org,
                slug=slug,
                defaults={
                    'name': name,
                    'description': desc,
                    'level': level,
                    'is_active': True,
                },
            )
            programmes[slug] = prog
            action = 'Created' if created else 'Exists'
            self.stdout.write(f'  {action}: Programme "{name}"')

        return programmes

    def _seed_courses(self, programmes, users, org):
        """Create courses within programmes."""
        instructor = users['instructor']
        courses_data = [
            # JHS Math courses
            ('Mathematics 7A', 'math-7a', 'jhs-math',
             'Grade 7 Mathematics - Algebraic expressions, linear equations, and coordinate geometry.',
             True),
            ('Mathematics 7B', 'math-7b', 'jhs-math',
             'Grade 7 Mathematics - Statistics, probability, and geometric transformations.',
             True),
            ('Mathematics 8A', 'math-8a', 'jhs-math',
             'Grade 8 Mathematics - Quadratic equations, functions, and Pythagorean theorem.',
             False),
            # SHS Physics courses
            ('Physics 10 Mechanics', 'phys-10-mech', 'shs-physics',
             'Grade 10 Physics - Kinematics, dynamics, energy, and momentum.',
             True),
            ('Physics 11 Electromagnetism', 'phys-11-em', 'shs-physics',
             'Grade 11 Physics - Electric circuits, magnetism, and electromagnetic waves.',
             False),
            # IELTS
            ('IELTS Academic Writing', 'ielts-writing', 'ielts-prep',
             'IELTS Academic Writing Task 1 and Task 2 strategies and practice.',
             True),
            # STEAM
            ('Robotics Fundamentals', 'robotics-fund', 'steam-robotics',
             'Introduction to robotics with Arduino, sensors, and basic programming.',
             True),
            # Teacher Dev
            ('Assessment Design Workshop', 'assess-design', 'teacher-dev',
             'Designing effective formative and summative assessments for diverse learners.',
             True),
        ]

        courses = {}
        for title, slug, prog_slug, desc, published in courses_data:
            prog = programmes[prog_slug]
            course, created = Course.objects.get_or_create(
                programme=prog,
                slug=slug,
                defaults={
                    'title': title,
                    'description': desc,
                    'organisation': org,
                    'instructor': instructor,
                    'is_published': published,
                },
            )
            courses[slug] = course
            action = 'Created' if created else 'Exists'
            status = 'Published' if published else 'Draft'
            self.stdout.write(f'  {action}: Course "{title}" ({status})')

        return courses

    def _seed_lessons(self, courses):
        """Create lessons for each course."""
        lessons_data = {
            'math-7a': [
                ('Algebraic Expressions', 1, 'text', 'Introduction to variables, terms, and simplifying expressions.'),
                ('Linear Equations', 2, 'text', 'Solving one-step and two-step linear equations.'),
                ('Inequalities', 3, 'text', 'Understanding and solving inequalities on the number line.'),
                ('Coordinate Geometry', 4, 'text', 'Plotting points, plotting lines, and finding gradients.'),
            ],
            'math-7b': [
                ('Data Collection & Presentation', 1, 'text', 'Surveys, frequency tables, and data visualization.'),
                ('Mean, Median, Mode', 2, 'text', 'Calculating and interpreting measures of central tendency.'),
                ('Probability Basics', 3, 'text', 'Experimental and theoretical probability.'),
                ('Transformations', 4, 'text', 'Reflections, rotations, translations, and dilations.'),
            ],
            'phys-10-mech': [
                ('Kinematics', 1, 'text', 'Distance, displacement, velocity, and acceleration.'),
                ("Newton's Laws", 2, 'text', 'Force, mass, and acceleration relationships.'),
                ('Work, Energy & Power', 3, 'text', 'Conservation of energy and work-energy theorem.'),
                ('Momentum & Collisions', 4, 'text', 'Linear momentum, impulse, and collision types.'),
            ],
            'ielts-writing': [
                ('Task 1: Data Description', 1, 'text', 'Describing charts, graphs, and tables accurately.'),
                ('Task 1: Process Diagrams', 2, 'text', 'Describing processes and sequences.'),
                ('Task 2: Essay Structure', 3, 'text', 'Planning and structuring a band 7+ essay.'),
                ('Task 2: Advanced Vocabulary', 4, 'text', 'Academic vocabulary and collocations for IELTS.'),
            ],
            'robotics-fund': [
                ('Arduino Basics', 1, 'text', 'Setting up Arduino and writing your first program.'),
                ('Sensors & Input', 2, 'text', 'Using ultrasonic, light, and temperature sensors.'),
                ('Motors & Output', 3, 'text', 'Controlling DC motors, servos, and LEDs.'),
                ('Building a Robot', 4, 'activity', 'Assembling and programming a line-following robot.'),
            ],
        }

        total = 0
        for slug, lessons in lessons_data.items():
            if slug in courses:
                for title, order, ctype, desc in lessons:
                    _, created = Lesson.objects.get_or_create(
                        course=courses[slug],
                        title=title,
                        defaults={
                            'description': desc,
                            'content_type': ctype,
                            'content_data': {'type': ctype, 'body': f'Content for {title}'},
                            'order': order,
                            'is_published': True,
                        }
                    )
                    if created:
                        total += 1

        self.stdout.write(f'  Created {total} lessons across {len(lessons_data)} courses.')

    def _seed_enrolments(self, users, courses, org):
        """Enrol students in courses."""
        student = users['student']
        enrolments_data = [
            'math-7a', 'math-7b', 'phys-10-mech', 'ielts-writing', 'robotics-fund',
        ]

        count = 0
        for slug in enrolments_data:
            if slug in courses:
                _, created = Enrolment.objects.get_or_create(
                    student=student,
                    course=courses[slug],
                    defaults={
                        'status': 'active',
                        'enrolled_by': users['admin'],
                    },
                )
                if created:
                    count += 1

        self.stdout.write(f'  Enrolled student in {count} courses.')

    def _seed_content(self, org, users):
        """Create sample content library items."""
        try:
            from content.models import ContentItem
        except ImportError:
            self.stdout.write('  Skipping content (app not available)')
            return

        content_data = [
            ('Algebra Cheat Sheet', 'document', 'Quick reference for algebraic formulas.'),
            ('Introduction to Kinematics Video', 'video', 'Video lecture on displacement, velocity, and acceleration.'),
            ('Periodic Table Poster', 'image', 'High-resolution periodic table for physics reference.'),
            ('Arduino Setup Guide', 'document', 'Step-by-step guide to setting up Arduino IDE.'),
            ('IELTS Writing Templates', 'document', 'Band 7+ essay templates and structures.'),
        ]

        count = 0
        for title, ctype, desc in content_data:
            _, created = ContentItem.objects.get_or_create(
                title=title,
                defaults={
                    'organisation': org,
                    'description': desc,
                    'content_type': ctype,
                    'uploaded_by': users['instructor'],
                },
            )
            if created:
                count += 1

        self.stdout.write(f'  Created {count} content items.')

    def _seed_activities(self, org, users):
        """Create sample activity definitions."""
        try:
            from activities.models import ActivityDefinition
        except ImportError:
            self.stdout.write('  Skipping activities (app not available)')
            return

        activities_data = [
            ('Algebra Quiz 1', 'multiple_choice', 'published'),
            ("Newton's Laws True/False", 'true_false', 'published'),
            ('Circuit Building Challenge', 'drag_and_drop', 'draft'),
            ('IELTS Writing Practice', 'essay', 'published'),
        ]

        count = 0
        for title, atype, status in activities_data:
            _, created = ActivityDefinition.objects.get_or_create(
                title=title,
                defaults={
                    'organisation': org,
                    'activity_type': atype,
                    'status': status,
                    'created_by': users['instructor'],
                    'learning_objectives': [f'Understand {title.lower()}'],
                },
            )
            if created:
                count += 1

        self.stdout.write(f'  Created {count} activity definitions.')

"""
Verify Supabase Auth users and Storage buckets via the Admin API.
Reads SUPABASE_URL + SUPABASE_SECRET_KEY from backend/.env. Prints no secrets.

Usage:
  python infrastructure/verify_supabase_api.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(REPO_ROOT, 'backend', '.env')

SEED_EMAILS = [
    'owner@mahardhika.id', 'admin@mahardhika.id', 'treasurer@mahardhika.id',
    'instructor@mahardhika.id', 'student@mahardhika.id', 'parent@mahardhika.id',
    'sponsor@mahardhika.id', 'thirdparty@mahardhika.id',
]
EXPECTED_BUCKETS = ['content-library', 'submissions', 'canvas-exports', 'certificates']


def load_env():
    cfg = {}
    if not os.path.exists(ENV_PATH):
        print(f'ERROR: {ENV_PATH} not found')
        sys.exit(1)
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    url = cfg.get('SUPABASE_URL', '')
    key = cfg.get('SUPABASE_SECRET_KEY', '')
    if not url or not key or 'placeholder' in url or 'placeholder' in key:
        print('ERROR: SUPABASE_URL / SUPABASE_SECRET_KEY missing or placeholder in backend/.env')
        sys.exit(1)
    return url.rstrip('/'), key


def request(url, key):
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {key}',
        'apikey': key,
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode()), None
    except urllib.error.HTTPError as e:
        return None, f'HTTP {e.code}: {e.read().decode()[:200]}'
    except Exception as e:
        return None, str(e)


def main():
    base, key = load_env()
    failures = 0

    # --- Auth users ---
    print('[1] Auth users:')
    data, err = request(f'{base}/auth/v1/admin/users?per_page=100', key)
    if err:
        failures += 1
        print(f'    ERROR: {err}')
    else:
        users = {u.get('email'): u for u in data.get('users', [])}
        print(f'    Total users in Supabase Auth: {len(users)}')
        for email in SEED_EMAILS:
            if email in users:
                u = users[email]
                confirmed = 'confirmed' if u.get('email_confirmed_at') else 'NOT CONFIRMED'
                print(f'    OK  {email}  ({confirmed})')
            else:
                failures += 1
                print(f'    MISSING: {email}  (run: python manage.py seed_data)')

    # --- Storage buckets ---
    print('\n[2] Storage buckets:')
    data, err = request(f'{base}/storage/v1/bucket', key)
    if err:
        failures += 1
        print(f'    ERROR: {err}  (migration 004 may not be applied yet)')
    else:
        buckets = {b.get('name'): b for b in data if isinstance(b, dict)}
        for b in EXPECTED_BUCKETS:
            if b not in buckets:
                failures += 1
                print(f'    MISSING: {b}  (run migration 004)')
            elif buckets[b].get('public'):
                failures += 1
                print(f'    PUBLIC (must be private!): {b}')
            else:
                print(f'    OK (private): {b}')
        extra = set(buckets) - set(EXPECTED_BUCKETS)
        if extra:
            print(f'    Other buckets: {", ".join(sorted(extra))}')

    print('\n' + '=' * 50)
    if failures == 0:
        print('RESULT: Auth + Storage verified OK.')
        print('NOTE: RLS policies cannot be checked via API — run')
        print('      infrastructure/verify_supabase.py with a real DATABASE_URL,')
        print('      or run the RLS verification query from supabase/SUPABASE_SETUP.md.')
    else:
        print(f'RESULT: {failures} issue(s) found — see above.')
    sys.exit(0 if failures == 0 else 1)


if __name__ == '__main__':
    main()

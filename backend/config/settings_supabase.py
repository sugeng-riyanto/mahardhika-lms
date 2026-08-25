"""
Django settings for running migrations/commands against the Supabase PostgreSQL
database WITHOUT changing local development (which stays on SQLite).

Usage:
  python manage.py migrate --settings=config.settings_supabase
  python manage.py seed_data --settings=config.settings_supabase

Requires SUPABASE_DATABASE_URL in backend/.env, e.g.:
  SUPABASE_DATABASE_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres

Never commit the real password. Local dev and tests keep using SQLite via
config.settings, so the normal workflow is unaffected.
"""
import os
from pathlib import Path

from .settings import *  # noqa: F401,F403 — inherit the full base config

BASE_DIR = Path(__file__).resolve().parent.parent

supabase_db_url = os.environ.get('SUPABASE_DATABASE_URL', '')

if not supabase_db_url.startswith('postgresql'):
    raise RuntimeError(
        '\n============================================================\n'
        'SUPABASE_DATABASE_URL is not set to a PostgreSQL URL.\n'
        '\n'
        'Add this line to backend/.env (with your real DB password):\n'
        '  SUPABASE_DATABASE_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres\n'
        '\n'
        'Get it from: Supabase Dashboard -> Project Settings -> Database\n'
        '============================================================'
    )

# Force SSL — Supabase requires encrypted connections.
if 'sslmode' not in supabase_db_url:
    sep = '&' if '?' in supabase_db_url else '?'
    supabase_db_url = f'{supabase_db_url}{sep}sslmode=require'

DATABASES = {
    'default': dj_database_url.parse(
        supabase_db_url,
        conn_max_age=60,
        ssl_require=True,
    ),
}

# Longer timeouts are safe for remote migrations.
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

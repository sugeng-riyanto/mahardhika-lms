"""
Django settings override for load testing.

Disables rate limiting and uses optimized settings for high-throughput testing.

Usage:
    cd backend
    python manage.py runserver 8000 --settings=config.settings_loadtest
"""

from config.settings import *  # noqa: F401,F403

# ── Disable Rate Limiting for Load Tests ──────────────────────
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {}

# ── Keep DEBUG off for production-like behavior ──────────────
DEBUG = False

# ── Increase DB connection pooling for concurrent access ─────
DATABASES['default']['CONN_MAX_AGE'] = 600

# ── Reduce logging overhead ─────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
    },
    'root': {
        'handlers': ['null'],
        'level': 'WARNING',
    },
}

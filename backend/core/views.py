import json
from django.http import JsonResponse
from django.db import connection


def health_check(request):
    """Health check endpoint for monitoring and load balancers."""
    checks = {
        'status': 'healthy',
        'database': 'unknown',
        'version': '0.1.0',
    }

    # Check database connectivity
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            checks['database'] = 'connected'
    except Exception as e:
        checks['database'] = f'error: {str(e)}'
        checks['status'] = 'unhealthy'

    status_code = 200 if checks['status'] == 'healthy' else 503
    return JsonResponse(checks, status=status_code)

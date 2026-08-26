"""
Cache-Control middleware for AKADEMI API responses.

Sets appropriate Cache-Control headers:
- Public endpoints (health, privacy notice): cache 5 minutes
- Authenticated endpoints: no-cache (must revalidate)
- Static assets: long cache (handled by CDN/Vite filenames)
"""


class CacheControlMiddleware:
    """Set Cache-Control headers on all API responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only set headers for API responses
        if request.path.startswith('/api/'):
            if request.user and request.user.is_authenticated:
                # Authenticated: no cache, must revalidate
                response['Cache-Control'] = 'private, no-cache, must-revalidate'
                response['Pragma'] = 'no-cache'
            else:
                # Public unauthenticated: short cache
                response['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=60'

        return response

import logging
from django.conf import settings
from rest_framework import authentication, exceptions
from rest_framework.request import Request

logger = logging.getLogger('audit')


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    Authenticate requests using Supabase JWT tokens.

    Flow:
    1. Extract Bearer token from Authorization header
    2. Verify JWT signature using JWKS
    3. Validate issuer, audience, expiry
    4. Match sub claim to local User record
    5. Return authenticated user
    """

    keyword = 'Bearer'

    def authenticate(self, request: Request):
        auth_header = authentication.get_authorization_header(request)
        if not auth_header:
            return None

        try:
            prefix, token = auth_header.split()
            # get_authorization_header returns bytes; decode for comparison
            if isinstance(prefix, bytes):
                prefix = prefix.decode('utf-8')
            if isinstance(token, bytes):
                token = token.decode('utf-8')
            if prefix.lower() != self.keyword.lower():
                return None
        except ValueError:
            return None

        if not token:
            return None

        user = self._authenticate_token(token)
        if user is None:
            raise exceptions.AuthenticationFailed('Invalid or expired token')

        return (user, token)

    def _authenticate_token(self, token: str):
        """Verify JWT and return User instance."""
        try:
            import jwt
            from jwt import PyJWKClient
        except ImportError:
            logger.error('PyJWT not installed')
            raise exceptions.AuthenticationFailed('JWT library not available')

        # For development with mock tokens, bypass JWT verification
        if token.startswith('mock-token-'):
            email = token.replace('mock-token-', '')
            return self._get_or_create_mock_user(email)

        try:
            # Get JWKS from Supabase
            jwks_url = settings.SUPABASE_JWKS_URL
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # Decode and verify
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256', 'ES256'],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
                options={
                    'verify_exp': True,
                    'verify_aud': True,
                    'verify_iss': True,
                },
            )

            # Extract user ID from sub claim
            supabase_uid = payload.get('sub')
            if not supabase_uid:
                raise exceptions.AuthenticationFailed('Invalid token: missing subject')

            # Look up user
            from identity.models import User
            try:
                return User.objects.get(supabase_uid=supabase_uid, is_active=True)
            except User.DoesNotExist:
                # Auto-create user from JWT claims
                return self._create_user_from_jwt(payload)

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token has expired')
        except jwt.InvalidAudienceError:
            raise exceptions.AuthenticationFailed('Invalid token audience')
        except jwt.InvalidIssuerError:
            raise exceptions.AuthenticationFailed('Invalid token issuer')
        except exceptions.AuthenticationFailed:
            raise
        except Exception as e:
            logger.error(f'JWT verification failed: {str(e)}')
            raise exceptions.AuthenticationFailed('Token verification failed')

    def _get_or_create_mock_user(self, email: str):
        """Create or get a mock user for development."""
        from identity.models import User
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'supabase_uid': f'mock-{email}',
                'full_name': email.split('@')[0].replace('.', ' ').title(),
                'is_active': True,
            },
        )
        return user

    def _create_user_from_jwt(self, payload: dict):
        """Create or link a user from JWT claims.

        If a user with this email already exists (e.g. from seed data),
        link their supabase_uid to enable real Supabase auth.
        """
        from identity.models import User

        supabase_uid = payload['sub']
        email = payload.get('email', '')
        full_name = payload.get('user_metadata', {}).get('full_name', email)

        # Check if user already exists by email (seed data)
        try:
            existing_user = User.objects.get(email=email)
            # Link the Supabase UID to the existing user
            if existing_user.supabase_uid != supabase_uid:
                existing_user.supabase_uid = supabase_uid
                existing_user.save(update_fields=['supabase_uid', 'updated_at'])
                logger.info(f'Linked Supabase UID to existing user: {email}')
            return existing_user
        except User.DoesNotExist:
            pass

        user = User.objects.create(
            supabase_uid=supabase_uid,
            email=email,
            full_name=full_name,
            is_active=True,
        )

        logger.info(f'Auto-created user from JWT: {email}')
        return user

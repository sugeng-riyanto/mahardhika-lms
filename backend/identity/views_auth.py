import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from identity.serializers import UserSerializer, RoleAssignmentSerializer
from identity.permissions import get_user_roles, get_user_organisation

logger = logging.getLogger('audit')


class AuthMeView(APIView):
    """Return current authenticated user info including roles and organisation."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = get_user_roles(user)
        organisation = get_user_organisation(user)

        # Get latest active role assignments
        role_assignments = RoleAssignmentSerializer(
            user.role_assignments.filter(status='active').select_related('role')[:10],
            many=True,
        ).data

        return Response({
            'user': UserSerializer(user).data,
            'roles': roles,
            'organisation_id': organisation.id if organisation else None,
            'role_assignments': role_assignments,
        })


class AuthTokenVerifyView(APIView):
    """Verify if a token is still valid."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'valid': True, 'user_id': str(request.user.id)})

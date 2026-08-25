from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from organisations.models import Organisation
from organisations.serializers import OrganisationSerializer
from identity.permissions import IsAdminOrOwner


class OrganisationViewSet(viewsets.ModelViewSet):
    """Organisation management."""
    queryset = Organisation.objects.all()
    serializer_class = OrganisationSerializer
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    search_fields = ['name', 'slug']
    filterset_fields = ['is_active', 'type']

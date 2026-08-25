import uuid
from django.db import models
from core.models import TimestampedModel


class Organisation(TimestampedModel):
    """Multi-tenant organisation."""
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    type = models.CharField(max_length=50, default='school')
    settings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'organisations'
        ordering = ['name']

    def __str__(self):
        return self.name

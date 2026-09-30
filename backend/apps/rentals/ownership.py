"""The one privacy rule of the API: a tenant only ever reads or writes their own rows.

Every viewset uses OwnedQuerysetMixin, and every foreign key a client can send uses OwnedPrimaryKeyRelatedField.
Someone else's id therefore behaves exactly like an id that does not exist (404 / "Invalid pk").
"""
from __future__ import annotations

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from django.db.models import Model, QuerySet


class OwnedQuerysetMixin:
    owner_lookup = 'property__owner'

    def get_queryset(self) -> QuerySet:
        queryset = super().get_queryset().filter(**{self.owner_lookup: self.request.user})
        property_id = self.request.query_params.get('property')
        if property_id and self.owner_lookup != 'owner':
            if not property_id.isdigit():
                raise ValidationError({'property': 'Must be a number.'})
            queryset = queryset.filter(property_id=property_id)
        return queryset


class OwnedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    def __init__(self, model: type[Model], owner_lookup: str = 'property__owner', **kwargs) -> None:
        self.model = model
        self.owner_lookup = owner_lookup
        # Never queried: get_queryset() below replaces it. It only tells the schema generator the model.
        kwargs.setdefault('queryset', model.objects.none())
        super().__init__(**kwargs)

    def get_queryset(self) -> QuerySet:
        return self.model.objects.filter(**{self.owner_lookup: self.context['request'].user})

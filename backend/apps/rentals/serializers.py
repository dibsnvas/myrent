from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from django.db.models import Q
from django.utils import timezone

from apps.rentals.constants import (
    DAY_OF_MONTH_MAX,
    DAY_OF_MONTH_MIN,
    MAX_CONTRACT_MONTHS,
    MONEY_DECIMAL_PLACES,
    MONEY_MAX_DIGITS,
)
from apps.rentals.models import Contract, Document, MeterReading, Payment, Property, Utility
from apps.rentals.ownership import OwnedPrimaryKeyRelatedField
from apps.rentals.services.schedule import months_between
from apps.rentals.services.uploads import file_link, prepare_upload


def _check_same_property(attrs: dict[str, Any], prop: Property, *fields: str) -> None:
    """Linked objects (utility, receipt, lease file...) must belong to the same home."""
    errors = {
        field: 'Belongs to a different home.'
        for field in fields
        if attrs.get(field) is not None and attrs[field].property_id != prop.id
    }
    if errors:
        raise serializers.ValidationError(errors)


def _check_lease_dates(start, end) -> None:
    if end <= start:
        raise serializers.ValidationError({'end_date': 'The lease must end after it starts.'})
    if months_between(start, end) > MAX_CONTRACT_MONTHS:
        raise serializers.ValidationError({'end_date': f'A lease can be at most {MAX_CONTRACT_MONTHS // 12} years.'})


class DocumentSerializer(serializers.ModelSerializer):
    property = OwnedPrimaryKeyRelatedField(Property, owner_lookup='owner')
    file = serializers.FileField(write_only=True, required=False)
    url = serializers.SerializerMethodField(help_text='Signed link, valid for 10 minutes.')
    is_image = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = (
            'id', 'property', 'kind', 'file', 'url', 'is_image', 'original_name', 'content_type', 'size',
            'room', 'description', 'taken_on', 'uploaded_at',
        )
        read_only_fields = ('original_name', 'content_type', 'size', 'uploaded_at')

    def get_url(self, obj: Document) -> str:
        return file_link(self.context['request'], obj)

    def get_is_image(self, obj: Document) -> bool:
        return obj.content_type.startswith('image/')

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.instance is None and 'file' not in attrs:
            raise serializers.ValidationError({'file': 'Choose a file to upload.'})
        if self.instance is not None and ('file' in attrs or 'property' in attrs):
            raise serializers.ValidationError('To replace a file, upload a new document and delete this one.')
        return attrs

    def create(self, validated_data: dict[str, Any]) -> Document:
        upload = validated_data.pop('file')
        prepared = prepare_upload(upload)
        document = Document(
            **validated_data,
            original_name=upload.name[:255],
            content_type=prepared.content_type,
            size=prepared.size,
        )
        if document.taken_on is None:
            document.taken_on = prepared.taken_on
        document.file.save(f'upload{prepared.extension}', prepared.content, save=False)
        document.save()
        return document


@extend_schema_field(DocumentSerializer(allow_null=True))
class NestedDocumentField(serializers.Field):
    """Read-only copy of a linked document (name + signed url) next to its id."""

    def __init__(self, source_field: str, **kwargs) -> None:
        self.source_field = source_field
        super().__init__(source='*', read_only=True, **kwargs)

    def to_representation(self, obj: Any) -> dict[str, Any] | None:
        document = getattr(obj, self.source_field)
        return DocumentSerializer(document, context=self.context).data if document else None


class ContractSerializer(serializers.ModelSerializer):
    property = OwnedPrimaryKeyRelatedField(Property, owner_lookup='owner')
    document = OwnedPrimaryKeyRelatedField(Document, required=False, allow_null=True)
    document_file = NestedDocumentField('document')
    renewal = serializers.SerializerMethodField(help_text='Id of the contract that renewed this one.')
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = (
            'id', 'property', 'previous', 'renewal', 'start_date', 'end_date', 'monthly_rent', 'rent_due_day',
            'deposit', 'terms', 'document', 'document_file', 'status', 'is_expired', 'created_at',
        )
        read_only_fields = ('previous', 'status', 'created_at')

    def get_renewal(self, obj: Contract) -> int | None:
        renewal = Contract.objects.filter(previous=obj).values_list('id', flat=True).first()
        return renewal

    def get_is_expired(self, obj: Contract) -> bool:
        return obj.end_date < timezone.localdate()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = self.instance
        prop = attrs.get('property') or instance.property
        if instance and prop != instance.property:
            raise serializers.ValidationError({'property': 'A lease cannot move to another home.'})
        start = attrs.get('start_date') or instance.start_date
        end = attrs.get('end_date') or instance.end_date
        _check_lease_dates(start, end)
        _check_same_property(attrs, prop, 'document')

        schedule_fields = {'start_date', 'end_date', 'monthly_rent', 'rent_due_day'}
        if instance and instance.status == Contract.Status.SUPERSEDED and schedule_fields & attrs.keys():
            raise serializers.ValidationError('This lease was renewed. Change the renewal instead.')

        overlapping = Contract.objects.filter(
            Q(start_date__lte=end) & Q(end_date__gte=start), property=prop, status=Contract.Status.ACTIVE
        ).exclude(pk=getattr(instance, 'pk', None))
        if overlapping.exists():
            raise serializers.ValidationError(
                'This home already has an active lease for these dates. Use "Renew" to record a new period.'
            )
        return attrs


class RenewContractSerializer(serializers.Serializer):
    """New lease period. Anything left out is copied from the current contract."""

    start_date = serializers.DateField(required=False, help_text='Default: the day after the current lease ends.')
    end_date = serializers.DateField()
    monthly_rent = serializers.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, min_value=Decimal('0.01'), required=False
    )
    rent_due_day = serializers.IntegerField(min_value=DAY_OF_MONTH_MIN, max_value=DAY_OF_MONTH_MAX, required=False)
    deposit = serializers.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, required=False, allow_null=True
    )
    terms = serializers.CharField(required=False, allow_blank=True)
    document = OwnedPrimaryKeyRelatedField(Document, required=False, allow_null=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        contract: Contract = self.context['contract']
        if contract.status != Contract.Status.ACTIVE:
            raise serializers.ValidationError('Only the current lease can be renewed.')
        attrs.setdefault('start_date', contract.end_date + timedelta(days=1))
        attrs.setdefault('monthly_rent', contract.monthly_rent)
        attrs.setdefault('rent_due_day', contract.rent_due_day)
        attrs.setdefault('deposit', contract.deposit)
        attrs.setdefault('terms', contract.terms)
        attrs.setdefault('document', None)
        if attrs['start_date'] <= contract.start_date:
            raise serializers.ValidationError({'start_date': 'The renewal must start after the current lease starts.'})
        _check_lease_dates(attrs['start_date'], attrs['end_date'])
        _check_same_property(attrs, contract.property, 'document')
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    property = OwnedPrimaryKeyRelatedField(Property, owner_lookup='owner')
    utility = OwnedPrimaryKeyRelatedField(Utility, required=False, allow_null=True)
    receipt = OwnedPrimaryKeyRelatedField(Document, required=False, allow_null=True)
    receipt_file = NestedDocumentField('receipt')
    display_title = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            'id', 'property', 'contract', 'kind', 'utility', 'title', 'display_title', 'period', 'amount',
            'due_date', 'paid_on', 'status', 'note', 'receipt', 'receipt_file', 'created_at',
        )
        read_only_fields = ('contract', 'created_at')

    def get_display_title(self, obj: Payment) -> str:
        return obj.display_title()

    @extend_schema_field(serializers.ChoiceField(choices=Payment.Status.choices))
    def get_status(self, obj: Payment) -> str:
        return obj.get_status()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance = self.instance
        prop = attrs.get('property') or instance.property
        if instance and prop != instance.property:
            raise serializers.ValidationError({'property': 'A payment cannot move to another home.'})
        kind = attrs.get('kind') or (instance.kind if instance else Payment.Kind.OTHER)
        utility = attrs['utility'] if 'utility' in attrs else getattr(instance, 'utility', None)
        if kind == Payment.Kind.UTILITY and utility is None:
            raise serializers.ValidationError({'utility': 'Choose which utility this bill is for.'})
        _check_same_property(attrs, prop, 'utility', 'receipt')
        if 'due_date' in attrs and not attrs.get('period') and not getattr(instance, 'period', None):
            attrs['period'] = attrs['due_date'].replace(day=1)
        return attrs


class MarkPaidSerializer(serializers.Serializer):
    paid_on = serializers.DateField(required=False, help_text='Default: today.')
    receipt = OwnedPrimaryKeyRelatedField(Document, required=False, allow_null=True)


class MeterReadingSerializer(serializers.ModelSerializer):
    utility = OwnedPrimaryKeyRelatedField(Utility)
    photo = OwnedPrimaryKeyRelatedField(Document, required=False, allow_null=True)
    photo_file = NestedDocumentField('photo')
    consumption = serializers.SerializerMethodField(help_text='Difference from the previous reading of this meter.')

    class Meta:
        model = MeterReading
        fields = (
            'id', 'property', 'utility', 'value', 'consumption', 'reading_date', 'photo', 'photo_file', 'note',
            'created_at',
        )
        read_only_fields = ('property', 'created_at')

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=3, allow_null=True))
    def get_consumption(self, obj: MeterReading) -> str | None:
        previous = (
            MeterReading.objects.filter(utility_id=obj.utility_id)
            .filter(Q(reading_date__lt=obj.reading_date) | Q(reading_date=obj.reading_date, id__lt=obj.id))
            .order_by('-reading_date', '-id')
            .first()
        )
        return str(obj.value - previous.value) if previous else None

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        utility = attrs.get('utility') or self.instance.utility
        if self.instance and utility.property_id != self.instance.property_id:
            raise serializers.ValidationError({'utility': 'A reading cannot move to another home.'})
        if not utility.has_meter:
            raise serializers.ValidationError({'utility': f'{utility.name} has no meter. Turn "has meter" on first.'})
        _check_same_property(attrs, utility.property, 'photo')
        return attrs

    def create(self, validated_data: dict[str, Any]) -> MeterReading:
        validated_data['property'] = validated_data['utility'].property
        return super().create(validated_data)


class UtilitySerializer(serializers.ModelSerializer):
    property = OwnedPrimaryKeyRelatedField(Property, owner_lookup='owner')
    last_reading = serializers.SerializerMethodField()

    class Meta:
        model = Utility
        fields = ('id', 'property', 'name', 'unit', 'has_meter', 'last_reading')

    @extend_schema_field(MeterReadingSerializer(allow_null=True))
    def get_last_reading(self, obj: Utility) -> dict[str, Any] | None:
        reading = obj.readings.order_by('-reading_date', '-id').first()
        return MeterReadingSerializer(reading, context=self.context).data if reading else None

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        prop = attrs.get('property') or self.instance.property
        if self.instance and prop != self.instance.property:
            raise serializers.ValidationError({'property': 'A utility cannot move to another home.'})
        name = attrs.get('name')
        if name:
            duplicates = Utility.objects.filter(property=prop, name__iexact=name.strip())
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError({'name': f'"{name}" already exists for this home.'})
            attrs['name'] = name.strip()
        return attrs


class PropertySerializer(serializers.ModelSerializer):
    active_contract = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = (
            'id', 'title', 'address', 'property_type', 'landlord_name', 'landlord_phone', 'landlord_email',
            'meter_reading_day', 'notes', 'active_contract', 'created_at',
        )
        read_only_fields = ('created_at',)

    @extend_schema_field(ContractSerializer(allow_null=True))
    def get_active_contract(self, obj: Property) -> dict[str, Any] | None:
        contract = obj.active_contract
        return ContractSerializer(contract, context=self.context).data if contract else None


class EventSerializer(serializers.Serializer):
    date = serializers.DateField()
    kind = serializers.ChoiceField(choices=('payment', 'meter_reading', 'contract_end'))
    title = serializers.CharField()
    property_id = serializers.IntegerField()
    property_title = serializers.CharField()
    object_id = serializers.IntegerField(allow_null=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    status = serializers.CharField(allow_blank=True)


class ReminderSerializer(serializers.Serializer):
    key = serializers.CharField()
    level = serializers.ChoiceField(choices=('overdue', 'soon', 'info'))
    date = serializers.DateField()
    title = serializers.CharField()
    property_id = serializers.IntegerField()
    property_title = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)

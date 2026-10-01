from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.http import FileResponse, HttpRequest
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.views.decorators.http import require_GET

from apps.rentals.models import Contract, Document, MeterReading, Payment, Property, Utility
from apps.rentals.ownership import OwnedQuerysetMixin
from apps.rentals.serializers import (
    ContractSerializer,
    DocumentSerializer,
    EventSerializer,
    MarkPaidSerializer,
    MeterReadingSerializer,
    PaymentSerializer,
    PropertySerializer,
    ReminderSerializer,
    RenewContractSerializer,
    UtilitySerializer,
)
from apps.rentals.services.events import calendar_events, month_bounds, reminders_for
from apps.rentals.services.notify import send_reminder_emails
from apps.rentals.services.schedule import delete_contract, renew_contract, sync_rent_schedule
from apps.rentals.services.uploads import document_for_token

PROPERTY_PARAM = OpenApiParameter('property', int, description='Only this home')
MONTH_PARAM = OpenApiParameter('month', str, description='YYYY-MM')


def _parse_month(value: str | None, *, required: bool = False) -> date | None:
    if not value:
        if required:
            raise ValidationError({'month': 'Required, format YYYY-MM.'})
        return None
    try:
        return datetime.strptime(value, '%Y-%m').date()
    except ValueError as exc:
        raise ValidationError({'month': 'Use the format YYYY-MM.'}) from exc


def _optional_int(value: str | None, name: str) -> int | None:
    if not value:
        return None
    if not value.isdigit():
        raise ValidationError({name: 'Must be a number.'})
    return int(value)


def _money(value: Decimal | None) -> str:
    return f'{value or Decimal(0):.2f}'


class PropertyViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    """The tenant's homes. Deleting a home deletes everything in it, files included."""

    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    owner_lookup = 'owner'

    def perform_create(self, serializer: PropertySerializer) -> None:
        serializer.save(owner=self.request.user)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True)
    def dashboard(self, request: Request, pk: str | None = None) -> Response:
        """Everything the home screen needs in one request."""
        prop = self.get_object()
        return Response(_dashboard(prop, request))


def _dashboard(prop: Property, request: Request) -> dict[str, Any]:
    today = timezone.localdate()
    context = {'request': request}
    unpaid = prop.payments.filter(paid_on__isnull=True)
    overdue = unpaid.filter(due_date__lt=today).aggregate(count=Count('id'), total=Sum('amount'))
    next_rent = unpaid.filter(kind=Payment.Kind.RENT, due_date__gte=today).select_related('utility').first()
    first, last = month_bounds(today.replace(day=1))
    this_month = prop.payments.filter(due_date__range=(first, last)).aggregate(
        total=Sum('amount'), paid=Sum('amount', filter=Q(paid_on__isnull=False))
    )
    documents = dict(prop.documents.order_by().values_list('kind').annotate(count=Count('id')))
    return {
        'property': PropertySerializer(prop, context=context).data,
        'next_rent': PaymentSerializer(next_rent, context=context).data if next_rent else None,
        'overdue': {'count': overdue['count'], 'total': _money(overdue['total'])},
        'this_month': {
            'month': f'{today:%Y-%m}',
            'total': _money(this_month['total']),
            'paid': _money(this_month['paid']),
            'unpaid': _money((this_month['total'] or 0) - (this_month['paid'] or 0)),
        },
        'utilities': UtilitySerializer(prop.utilities.all(), many=True, context=context).data,
        'reminders': ReminderSerializer(reminders_for(prop.owner, today, property_id=prop.id), many=True).data,
        'documents': {kind: documents.get(kind, 0) for kind in Document.Kind.values} | {
            'total': sum(documents.values())
        },
    }


@extend_schema(parameters=[PROPERTY_PARAM])
class ContractViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    """Leases. Creating or changing one regenerates its unpaid monthly rent rows."""

    queryset = Contract.objects.select_related('property', 'document')
    serializer_class = ContractSerializer

    def perform_create(self, serializer: ContractSerializer) -> None:
        sync_rent_schedule(serializer.save())

    def perform_update(self, serializer: ContractSerializer) -> None:
        contract = serializer.save()
        if contract.status == Contract.Status.ACTIVE:
            sync_rent_schedule(contract)

    def perform_destroy(self, instance: Contract) -> None:
        delete_contract(instance)

    @extend_schema(request=RenewContractSerializer, responses={201: ContractSerializer})
    @action(detail=True, methods=['post'])
    def renew(self, request: Request, pk: str | None = None) -> Response:
        """Record a new lease period. The current one is kept as history."""
        contract = self.get_object()
        serializer = RenewContractSerializer(data=request.data, context={'request': request, 'contract': contract})
        serializer.is_valid(raise_exception=True)
        new = renew_contract(contract, **serializer.validated_data)
        return Response(ContractSerializer(new, context={'request': request}).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[
    PROPERTY_PARAM,
    MONTH_PARAM,
    OpenApiParameter('kind', str, enum=Payment.Kind.values),
    OpenApiParameter('status', str, enum=Payment.Status.values),
    OpenApiParameter('utility', int),
])
class PaymentViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    """Rent, utility bills and other payments."""

    queryset = Payment.objects.select_related('utility', 'receipt')
    serializer_class = PaymentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        month = _parse_month(params.get('month'))
        if month:
            queryset = queryset.filter(due_date__range=month_bounds(month))
        if params.get('kind'):
            queryset = queryset.filter(kind=params['kind'])
        utility_id = _optional_int(params.get('utility'), 'utility')
        if utility_id:
            queryset = queryset.filter(utility_id=utility_id)
        payment_status = params.get('status')
        if payment_status == Payment.Status.PAID:
            queryset = queryset.filter(paid_on__isnull=False)
        elif payment_status == Payment.Status.DUE:
            queryset = queryset.filter(paid_on__isnull=True, due_date__gte=timezone.localdate())
        elif payment_status == Payment.Status.OVERDUE:
            queryset = queryset.filter(paid_on__isnull=True, due_date__lt=timezone.localdate())
        return queryset

    @extend_schema(request=MarkPaidSerializer, responses=PaymentSerializer)
    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request: Request, pk: str | None = None) -> Response:
        payment = self.get_object()
        serializer = MarkPaidSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        receipt = serializer.validated_data.get('receipt')
        if receipt and receipt.property_id != payment.property_id:
            raise ValidationError({'receipt': 'Belongs to a different home.'})
        payment.paid_on = serializer.validated_data.get('paid_on') or timezone.localdate()
        if receipt:
            payment.receipt = receipt
        payment.save(update_fields=['paid_on', 'receipt'])
        return Response(self.get_serializer(payment).data)

    @extend_schema(request=None, responses=PaymentSerializer)
    @action(detail=True, methods=['post'], url_path='mark-unpaid')
    def mark_unpaid(self, request: Request, pk: str | None = None) -> Response:
        payment = self.get_object()
        payment.paid_on = None
        payment.save(update_fields=['paid_on'])
        return Response(self.get_serializer(payment).data)


@extend_schema(parameters=[PROPERTY_PARAM])
class UtilityViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    """Utility categories. Deleting one deletes its meter readings; its bills stay, without a category."""

    queryset = Utility.objects.all()
    serializer_class = UtilitySerializer


@extend_schema(parameters=[PROPERTY_PARAM, OpenApiParameter('utility', int)])
class MeterReadingViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    queryset = MeterReading.objects.select_related('utility', 'photo')
    serializer_class = MeterReadingSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        utility_id = _optional_int(self.request.query_params.get('utility'), 'utility')
        return queryset.filter(utility_id=utility_id) if utility_id else queryset


@extend_schema(parameters=[PROPERTY_PARAM, OpenApiParameter('kind', str, enum=Document.Kind.values)])
class DocumentViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    """Upload with multipart/form-data. Allowed: PDF up to 10 MB, JPG/PNG/WEBP up to 5 MB."""

    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    http_method_names = ('get', 'post', 'patch', 'delete', 'head', 'options')

    def get_queryset(self):
        queryset = super().get_queryset()
        kind = self.request.query_params.get('kind')
        return queryset.filter(kind=kind) if kind else queryset


class CalendarView(APIView):
    @extend_schema(parameters=[MONTH_PARAM, PROPERTY_PARAM], responses=EventSerializer(many=True))
    def get(self, request: Request) -> Response:
        """Rent and bill due dates, meter-reading days and lease ends for one month."""
        month = _parse_month(request.query_params.get('month'), required=True)
        property_id = _optional_int(request.query_params.get('property'), 'property')
        events = calendar_events(request.user, month, property_id)
        return Response(EventSerializer(events, many=True).data)


class RemindersView(APIView):
    @extend_schema(parameters=[PROPERTY_PARAM], responses=ReminderSerializer(many=True))
    def get(self, request: Request) -> Response:
        """Overdue and upcoming items, calculated now. Shown as the dashboard banner."""
        property_id = _optional_int(request.query_params.get('property'), 'property')
        reminders = reminders_for(request.user, timezone.localdate(), property_id)
        return Response(ReminderSerializer(reminders, many=True).data)


class SendRemindersView(APIView):
    """Called once a day by the GitHub Actions cron with the X-Cron-Secret header."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request: Request) -> Response:
        secret = settings.CRON_SECRET
        if not secret or not constant_time_compare(request.headers.get('X-Cron-Secret', ''), secret):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return Response({'emails_sent': send_reminder_emails(timezone.localdate())})


@require_GET
def document_file(request: HttpRequest, token: str) -> FileResponse:
    """Stream a stored file. The signed token in the URL is the permission check."""
    document = document_for_token(token)
    response = FileResponse(
        document.file.open('rb'),
        content_type=document.content_type,
        filename=document.original_name,
    )
    response['Cache-Control'] = 'private, max-age=600'
    return response

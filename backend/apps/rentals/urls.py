from rest_framework.routers import DefaultRouter

from django.urls import path

from apps.rentals.views import (
    CalendarView,
    ContractViewSet,
    DocumentViewSet,
    MeterReadingViewSet,
    PaymentViewSet,
    PropertyViewSet,
    RemindersView,
    SendRemindersView,
    UtilityViewSet,
    document_file,
)

router = DefaultRouter()
router.register('properties', PropertyViewSet, basename='property')
router.register('contracts', ContractViewSet, basename='contract')
router.register('payments', PaymentViewSet, basename='payment')
router.register('utilities', UtilityViewSet, basename='utility')
router.register('meter-readings', MeterReadingViewSet, basename='meter-reading')
router.register('documents', DocumentViewSet, basename='document')

urlpatterns = [
    path('calendar/', CalendarView.as_view(), name='calendar'),
    path('reminders/', RemindersView.as_view(), name='reminders'),
    path('internal/send-reminders/', SendRemindersView.as_view(), name='send-reminders'),
    path('files/<str:token>/', document_file, name='document-file'),
    *router.urls,
]

from django.contrib import admin

from apps.rentals.models import Contract, Document, MeterReading, Payment, Property, ReminderLog, Utility


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'property_type', 'address', 'created_at')
    list_filter = ('property_type',)
    search_fields = ('title', 'address', 'owner__email')


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ('property', 'start_date', 'end_date', 'monthly_rent', 'rent_due_day', 'status')
    list_filter = ('status',)
    search_fields = ('property__title',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('property', 'kind', 'title', 'amount', 'due_date', 'paid_on')
    list_filter = ('kind',)
    search_fields = ('property__title', 'title')
    date_hierarchy = 'due_date'


@admin.register(Utility)
class UtilityAdmin(admin.ModelAdmin):
    list_display = ('name', 'property', 'unit', 'has_meter')


@admin.register(MeterReading)
class MeterReadingAdmin(admin.ModelAdmin):
    list_display = ('utility', 'property', 'value', 'reading_date')
    date_hierarchy = 'reading_date'


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'property', 'kind', 'room', 'content_type', 'size', 'uploaded_at')
    list_filter = ('kind', 'content_type')


@admin.register(ReminderLog)
class ReminderLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'key', 'sent_at')

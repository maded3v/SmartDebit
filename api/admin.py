from django.contrib import admin
from api.models import User, Account, ServiceDictionary, RecurringPayment, Transaction, Notification

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'internal_id', 'is_smartdebit_enabled')

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'balance')

@admin.register(ServiceDictionary)
class ServiceDictionaryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'is_mandatory')

@admin.register(RecurringPayment)
class RecurringPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'service', 'amount', 'status')

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'merchant_name', 'amount', 'transaction_date')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'notification_type', 'message', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
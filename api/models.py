from django.db import models

class User(models.Model):
    internal_id = models.CharField(max_length=100, unique=True, db_index=True)
    is_smartdebit_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.internal_id

class Account(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts')
    balance = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="RUB")
    def __str__(self):
        return f"{self.user.internal_id} - {self.balance}"

class ServiceDictionary(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    is_mandatory = models.BooleanField(default=False)
    icon_url = models.CharField(max_length=500, blank=True, null=True)
    def __str__(self):
        return self.name

PAYMENT_STATUS_CHOICES = [
    ('active', 'Active'),
    ('frozen', 'Frozen'),
    ('cancelled', 'Cancelled'),
    ('paid', 'Paid'),
    ('low_balance', 'Low Balance'),
]

class RecurringPayment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recurring_payments')
    service = models.ForeignKey(ServiceDictionary, on_delete=models.SET_NULL, null=True, blank=True)
    custom_name = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    next_charge_date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, default='active', choices=PAYMENT_STATUS_CHOICES, db_index=True)
    def __str__(self):
        name = self.service.name if self.service else self.custom_name
        return f"{name} - {self.amount} ({self.next_charge_date})"

class Transaction(models.Model):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    merchant_name = models.CharField(max_length=255, db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_date = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, default='completed')
    def __str__(self):
        return f"{self.merchant_name} - {self.amount}"

# НОВАЯ ТАБЛИЦА ПО ТЗ (Task 1.1)
class Notification(models.Model):
    TYPE_CHOICES = [
        ('upcoming', 'Upcoming Payment'),
        ('low_balance', 'Low Balance'),
        ('missed', 'Missed Payment'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    payment = models.ForeignKey(RecurringPayment, on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return f"{self.get_notification_type_display()} for {self.user.internal_id}"
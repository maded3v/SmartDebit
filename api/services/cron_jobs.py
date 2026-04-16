from datetime import datetime, date, timedelta
from api.models import RecurringPayment, Account, Transaction
from django.utils import timezone

def daily_alert_generator():
    tomorrow = date.today() + timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=tomorrow,
        status='active'
    )
    
    alerts = []
    for payment in payments:
        alerts.append({
            'user_id': payment.user.id,
            'payment_id': payment.id,
            'service_name': payment.service.name if payment.service else payment.custom_name,
            'amount': payment.amount,
            'scheduled_date': tomorrow
        })
    
    return alerts

def low_balance_checker():
    tomorrow = date.today() + timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=tomorrow,
        status='active'
    )
    
    low_balance_payments = []
    for payment in payments:
        account = Account.objects.filter(user=payment.user).first()
        if account and account.balance < payment.amount:
            payment.status = 'low_balance'
            payment.save()
            low_balance_payments.append({
                'payment_id': payment.id,
                'user_id': payment.user.id,
                'amount': payment.amount,
                'balance': account.balance
            })
    
    return low_balance_payments

def missed_payment_detector():
    yesterday = date.today() - timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=yesterday,
        status='active'
    )
    
    missed = []
    for payment in payments:
        transaction_exists = Transaction.objects.filter(
            account__user=payment.user,
            amount=payment.amount,
            transaction_date__date=yesterday
        ).exists()
        
        if not transaction_exists:
            payment.status = 'low_balance'
            payment.save()
            missed.append({
                'payment_id': payment.id,
                'user_id': payment.user.id,
                'service_name': payment.service.name if payment.service else payment.custom_name,
                'amount': payment.amount
            })
    
    return missed
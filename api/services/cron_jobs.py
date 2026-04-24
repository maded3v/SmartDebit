from datetime import datetime, date, timedelta
from api.models import RecurringPayment, Account, Transaction, Notification
from django.utils import timezone


def daily_alert_generator():
    '''находит платежи, у которых списание завтра, создаёт уведомления в БД'''
    tomorrow = date.today() + timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=tomorrow,
        status='active'
    ).select_related('user', 'service')

    alerts = []
    for payment in payments:
        service_name = payment.service.name if payment.service else payment.custom_name
        Notification.objects.create(
            user=payment.user,
            payment=payment,
            message=f"Завтра спишется {payment.amount} ₽ за {service_name}",
            notification_type='upcoming'
        )
        alerts.append({
            'user_id': payment.user.id,
            'payment_id': payment.id,
            'service_name': service_name,
            'amount': payment.amount,
            'scheduled_date': tomorrow
        })

    return alerts


def low_balance_checker():
    '''сравнивает сумму завтрашних платежей с балансом, помечает low_balance если денег не хватает'''
    tomorrow = date.today() + timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=tomorrow,
        status='active'
    ).select_related('user', 'service')

    low_balance_payments = []
    for payment in payments:
        account = Account.objects.filter(user=payment.user).first()
        if account and account.balance < payment.amount:
            payment.status = 'low_balance'
            payment.save()
            service_name = payment.service.name if payment.service else payment.custom_name
            Notification.objects.create(
                user=payment.user,
                payment=payment,
                message=f"Недостаточно средств для списания {payment.amount} ₽ за {service_name}",
                notification_type='low_balance'
            )
            low_balance_payments.append({
                'payment_id': payment.id,
                'user_id': payment.user.id,
                'amount': payment.amount,
                'balance': account.balance
            })

    return low_balance_payments


def missed_payment_detector():
    '''проверяет вчерашние платежи, если транзакции нет - помечает как пропущенный'''
    yesterday = date.today() - timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=yesterday,
        status='active'
    ).select_related('user', 'service')

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
            service_name = payment.service.name if payment.service else payment.custom_name
            Notification.objects.create(
                user=payment.user,
                payment=payment,
                message=f"Пропущен платёж {payment.amount} ₽ за {service_name} за {yesterday}",
                notification_type='missed'
            )
            missed.append({
                'payment_id': payment.id,
                'user_id': payment.user.id,
                'service_name': service_name,
                'amount': payment.amount
            })

    return missed

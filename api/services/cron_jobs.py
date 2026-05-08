from datetime import date, timedelta

from api.models import Account, Notification, RecurringPayment, Transaction


def daily_alert_generator():
    today = date.today()
    tomorrow = today + timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=tomorrow,
        status='active',
    ).select_related('user', 'service')

    alerts = []
    for payment in payments:
        already_notified = Notification.objects.filter(
            user=payment.user,
            payment=payment,
            notification_type='upcoming',
            created_at__date__in=[today - timedelta(days=1), today],
        ).exists()
        if already_notified:
            continue

        service_name = payment.service.name if payment.service else payment.custom_name
        Notification.objects.create(
            user=payment.user,
            payment=payment,
            message=f'Завтра спишется {payment.amount} ₽ за {service_name}',
            notification_type='upcoming',
        )
        alerts.append({
            'user_id': payment.user.id,
            'payment_id': payment.id,
            'service_name': service_name,
            'amount': payment.amount,
            'scheduled_date': tomorrow,
        })

    return alerts


def low_balance_checker():
    today = date.today()
    tomorrow = today + timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=tomorrow,
        status='active',
    ).select_related('user', 'service')

    low_balance_payments = []
    for payment in payments:
        account = Account.objects.filter(user=payment.user).first()
        if not (account and account.balance < payment.amount):
            continue

        payment.status = 'low_balance'
        payment.save(update_fields=['status'])

        service_name = payment.service.name if payment.service else payment.custom_name
        Notification.objects.create(
            user=payment.user,
            payment=payment,
            message=f'Недостаточно средств для списания {payment.amount} ₽ за {service_name}',
            notification_type='low_balance',
        )
        low_balance_payments.append({
            'payment_id': payment.id,
            'user_id': payment.user.id,
            'amount': payment.amount,
            'balance': account.balance,
        })

    return low_balance_payments


def missed_payment_detector():
    today = date.today()
    yesterday = today - timedelta(days=1)
    payments = RecurringPayment.objects.filter(
        next_charge_date=yesterday,
        status='active',
    ).select_related('user', 'service')

    missed = []
    for payment in payments:
        transaction_exists = Transaction.objects.filter(
            account__user=payment.user,
            amount=payment.amount,
            transaction_date__date=yesterday,
        ).exists()

        if transaction_exists:
            continue

        payment.status = 'low_balance'
        payment.save(update_fields=['status'])

        service_name = payment.service.name if payment.service else payment.custom_name
        Notification.objects.create(
            user=payment.user,
            payment=payment,
            message=f'Пропущен платеж {payment.amount} ₽ за {service_name} за {yesterday}',
            notification_type='missed',
        )
        missed.append({
            'payment_id': payment.id,
            'user_id': payment.user.id,
            'service_name': service_name,
            'amount': payment.amount,
        })

    return missed

from datetime import datetime, timedelta
from collections import Counter
from api.models import Transaction, RecurringPayment, ServiceDictionary
from decimal import Decimal
import calendar

def find_recurring_patterns(user, months=3):
    start_date = datetime.now() - timedelta(days=months*30)
    transactions = Transaction.objects.filter(
        account__user=user,
        transaction_date__gte=start_date
    )
    
    merchant_groups = {}
    for t in transactions:
        if t.merchant_name not in merchant_groups:
            merchant_groups[t.merchant_name] = []
        merchant_groups[t.merchant_name].append(t)
    
    patterns = []
    for merchant, txns in merchant_groups.items():
        if len(txns) >= 2:
            amounts = [float(t.amount) for t in txns]
            amount_counter = Counter(amounts)
            most_common_amount = amount_counter.most_common(1)[0][0]
            
            recurring_txns = [t for t in txns if float(t.amount) == most_common_amount]
            if len(recurring_txns) >= 2:
                dates = sorted([t.transaction_date for t in recurring_txns])
                intervals = []
                for i in range(1, len(dates)):
                    delta = (dates[i] - dates[i-1]).days
                    intervals.append(delta)
                
                if intervals:
                    avg_interval = sum(intervals) / len(intervals)
                    patterns.append({
                        'merchant': merchant,
                        'amount': Decimal(str(most_common_amount)),
                        'avg_interval_days': avg_interval,
                        'last_date': dates[-1],
                        'occurrences': len(recurring_txns)
                    })
    
    return patterns

def predict_next_charge_date(last_date, interval_days):
    next_date = last_date + timedelta(days=interval_days)
    _, last_day = calendar.monthrange(next_date.year, next_date.month)
    day = min(next_date.day, last_day)
    next_date = next_date.replace(day=day)
    
    if next_date.weekday() >= 5:
        days_to_monday = 7 - next_date.weekday()
        next_date += timedelta(days=days_to_monday)
    
    return next_date 

def match_service(merchant_name):
    services = ServiceDictionary.objects.all()
    for service in services:
        if service.name.lower() in merchant_name.lower() or merchant_name.lower() in service.name.lower():
            return service
    return None

def create_recurring_payments_from_patterns(user, patterns):
    created_count = 0
    for pattern in patterns:
        service = match_service(pattern['merchant'])
        next_date = predict_next_charge_date(
            pattern['last_date'],
            pattern['avg_interval_days']
        )
        
        payment, created = RecurringPayment.objects.get_or_create(
            user=user,
            service=service,
            custom_name=pattern['merchant'] if not service else '',
            amount=pattern['amount'],
            defaults={
                'next_charge_date': next_date,
                'status': 'active'
            }
        )
        if created:
            created_count += 1
    
    return created_count
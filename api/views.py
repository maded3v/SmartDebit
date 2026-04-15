from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
import json
from datetime import datetime, timedelta
from api.models import ServiceDictionary, RecurringPayment, User, Account
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from api.services.parser import find_recurring_patterns, create_recurring_payments_from_patterns
from api.services.cron_jobs import daily_alert_generator, low_balance_checker, missed_payment_detector


def get_mock_dashboard_data(user_id):
    """Заглушка для дашборда — потом заменим на реальную аналитику"""
    return {
        "balance": 75430.50,
        "currency": "RUB",
        "upcoming_payments": [
            {"id": 1, "service_name": "Ипотека Сбербанк", "amount": 45000.00, "next_charge_date": "2026-04-16", "category": "Кредиты", "is_mandatory": True, "status": "active"},
            {"id": 2, "service_name": "Яндекс Плюс", "amount": 299.00, "next_charge_date": "2026-04-17", "category": "Развлечения", "is_mandatory": False, "status": "active"},
            {"id": 3, "service_name": "KION", "amount": 499.00, "next_charge_date": "2026-04-18", "category": "Кино", "is_mandatory": False, "status": "low_balance"}
        ],
        "alerts": [{"id": 3, "service_name": "KION", "message": "Недостаточно средств для списания", "amount": 499.00, "type": "low_balance"}],
        "analytics": {"entertainment": 798.00, "utilities": 0.00, "finance": 45000.00}
    }

# Временные данные для демонстрации дашборда
def get_mock_dashboard_data(user_id):
    """Заглушка для дашборда — потом заменим на реальную аналитику"""
    return {
        "balance": 75430.50,
        "currency": "RUB",
        "upcoming_payments": [
            {
                "id": 1,
                "service_name": "Ипотека Сбербанк",
                "amount": 45000.00,
                "next_charge_date": "2026-04-16",
                "category": "Кредиты",
                "is_mandatory": True,
                "status": "active"
            },
            {
                "id": 2,
                "service_name": "Яндекс Плюс",
                "amount": 299.00,
                "next_charge_date": "2026-04-17",
                "category": "Развлечения",
                "is_mandatory": False,
                "status": "active"
            },
            {
                "id": 3,
                "service_name": "KION",
                "amount": 499.00,
                "next_charge_date": "2026-04-18",
                "category": "Кино",
                "is_mandatory": False,
                "status": "low_balance"
            }
        ],
        "alerts": [
            {
                "id": 3,
                "service_name": "KION",
                "message": "Недостаточно средств для списания",
                "amount": 499.00,
                "type": "low_balance"
            }
        ],
        "analytics": {
            "entertainment": 798.00,
            "utilities": 0.00,
            "finance": 45000.00
        }
    }

@extend_schema(
    summary="Получить список сервисов",
    description="Возвращает все сервисы из справочника SERVICE_DICTIONARY",
    tags=["SmartDebit"],
)
def get_services(request):
    services_qs = ServiceDictionary.objects.all()
    
    data = [
        {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "is_mandatory": s.is_mandatory
        } for s in services_qs
    ]
    
    return JsonResponse({"status": "success", "services": data})

@extend_schema(
    summary="Дашборд SmartDebit",
    description="Возвращает баланс, предстоящие платежи, алерты и аналитику",
    tags=["SmartDebit"],
)
def get_dashboard(request):
    user_id = 1
    user = User.objects.filter(internal_id=f"user_{user_id}").first()
    if not user:
        return JsonResponse({"status": "error", "message": "User not found"}, status=404)
    
    account = Account.objects.filter(user=user).first()
    balance = float(account.balance) if account else 0.0
    
    payments_qs = RecurringPayment.objects.filter(
        user=user, 
        status__in=['active', 'low_balance']
    ).select_related('service').order_by('next_charge_date')[:5]
    
    upcoming = [
        {
            "id": p.id,
            "service_name": p.service.name if p.service else p.custom_name,
            "amount": float(p.amount),
            "next_charge_date": p.next_charge_date.strftime("%Y-%m-%d"),
            "category": p.service.category if p.service else "Other",
            "is_mandatory": p.service.is_mandatory if p.service else False,
            "status": p.status
        } for p in payments_qs
    ]
    
    alerts = []
    for p in payments_qs:
        if p.status == 'low_balance' or (account and account.balance < p.amount):
            alerts.append({
                "id": p.id,
                "service_name": p.service.name if p.service else p.custom_name,
                "message": "Недостаточно средств для списания" if account and account.balance < p.amount else "Предстоящий платеж",
                "amount": float(p.amount),
                "type": "low_balance" if account and account.balance < p.amount else "upcoming"
            })
    
    # ИСПРАВЛЕННАЯ АНАЛИТИКА: Маппинг русских категорий на английские ключи
    CATEGORY_MAP = {
        "Развлечения": "entertainment",
        "Кино": "entertainment",
        "Подписки": "entertainment",
        "ЖКХ": "utilities",
        "Кредиты": "finance",
    }
    
    analytics = {"entertainment": 0, "utilities": 0, "finance": 0}
    for p in payments_qs:
        cat = p.service.category if p.service else "Other"
        analytics_key = CATEGORY_MAP.get(cat)
        if analytics_key:
            analytics[analytics_key] += float(p.amount)
    
    return JsonResponse({
        "status": "success",
        "data": {
            "balance": balance,
            "currency": "RUB",
            "upcoming_payments": upcoming,
            "alerts": alerts,
            "analytics": analytics
        }
    })
    
@extend_schema(
    summary="Активация SmartDebit",
    description="Включает или выключает функцию SmartDebit для пользователя",
    tags=["SmartDebit"],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'user_id': {'type': 'integer', 'example': 1},
                'enabled': {'type': 'boolean', 'example': True}
            }
        }
    },
)
@csrf_exempt
@require_http_methods(["POST"])
def toggle_smartdebit(request):
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id', 1)
        enabled = data.get('enabled', True)
        
        user, created = User.objects.get_or_create(
            internal_id=f"user_{user_id}",
            defaults={'is_smartdebit_enabled': enabled}
        )
        
        if not created:
            user.is_smartdebit_enabled = enabled
            user.save()
        
        if not user.accounts.exists():
            Account.objects.create(user=user, balance=75430.50)
        
        analyzed_count = 0
        if enabled:
            patterns = find_recurring_patterns(user, months=3)
            analyzed_count = create_recurring_payments_from_patterns(user, patterns)
        
        return JsonResponse({
            "status": "success",
            "message": f"SmartDebit {'включен' if enabled else 'выключен'}",
            "data": {
                "user_id": user.internal_id,
                "is_smartdebit_enabled": user.is_smartdebit_enabled,
                "patterns_analyzed": analyzed_count
            }
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)
    
@extend_schema(
    summary="Управление платежами",
    description="GET: Список всех платежей пользователя\nPOST: Создание нового регулярного платежа",
    tags=["Payments"],
    parameters=[
        OpenApiParameter(
            name='user_id',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='ID пользователя',
            default=1
        ),
    ],
)
@csrf_exempt
@require_http_methods(["GET", "POST"])
def payments_list_create(request):
    """
    Task 2.3: Список платежей (GET) и создание нового (POST)
    GET /api/v1/payments/
    POST /api/v1/payments/
    """
    if request.method == "GET":
        # Возвращаем все платежи пользователя
        user_id = request.GET.get('user_id', 1)
        user = User.objects.filter(internal_id=f"user_{user_id}").first()
        
        if not user:
            return JsonResponse({"status": "error", "message": "User not found"}, status=404)
        
        payments = RecurringPayment.objects.filter(user=user)
        
        data = [
            {
                "id": p.id,
                "service_name": p.service.name if p.service else p.custom_name,
                "amount": float(p.amount),
                "next_charge_date": p.next_charge_date.strftime("%Y-%m-%d"),
                "category": p.service.category if p.service else "Other",
                "is_mandatory": p.service.is_mandatory if p.service else False,
                "status": p.status
            } for p in payments
        ]
        
        return JsonResponse({
            "status": "success",
            "payments": data
        })
    
    elif request.method == "POST":
        # Создаем новый платеж
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id', 1)
            user = User.objects.get(internal_id=f"user_{user_id}")
            
            # Определяем сервис или создаем кастомный
            service_id = data.get('service_id')
            service = ServiceDictionary.objects.get(id=service_id) if service_id else None
            
            payment = RecurringPayment.objects.create(
                user=user,
                service=service,
                custom_name=data.get('custom_name', ''),
                amount=data['amount'],
                next_charge_date=datetime.strptime(data['next_charge_date'], "%Y-%m-%d").date(),
                status='active'
            )
            
            return JsonResponse({
                "status": "success",
                "message": "Платеж создан",
                "payment": {
                    "id": payment.id,
                    "service_name": service.name if service else payment.custom_name,
                    "amount": float(payment.amount),
                    "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d"),
                    "status": payment.status
                }
            }, status=201)
            
        except Exception as e:
            return JsonResponse({
                "status": "error",
                "message": str(e)
            }, status=400)

@extend_schema(
    summary="Детали платежа",
    description="PATCH: Изменить статус платежа\nDELETE: Удалить платеж\nPUT: Полное обновление платежа",
    tags=["Payments"],
    parameters=[
        OpenApiParameter(
            name='payment_id',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description='ID платежа',
        ),
    ],
)
@csrf_exempt
@require_http_methods(["PATCH", "DELETE", "PUT"])
def payment_detail(request, payment_id):
    """
    Task 2.3 + 2.4: Обновление, удаление платежа и смена статуса
    PATCH /api/v1/payments/{id}/status
    DELETE /api/v1/payments/{id}
    """
    try:
        payment = RecurringPayment.objects.get(id=payment_id)
        
        # Task 2.4: Проверка на обязательный платеж
        if payment.service and payment.service.is_mandatory:
            if request.method == "PATCH":
                data = json.loads(request.body)
                new_status = data.get('status')
                if new_status in ['cancelled', 'frozen']:
                    return JsonResponse({
                        "status": "error",
                        "message": "Нельзя отключить обязательный платеж",
                        "error_code": "MANDATORY_PAYMENT"
                    }, status=403)
        
        if request.method == "PATCH":
            # Обновляем статус
            data = json.loads(request.body)
            new_status = data.get('status')
            
            if new_status not in ['active', 'frozen', 'cancelled']:
                return JsonResponse({
                    "status": "error",
                    "message": "Невалидный статус"
                }, status=400)
            
            payment.status = new_status
            payment.save()
            
            return JsonResponse({
                "status": "success",
                "message": f"Статус изменен на {new_status}",
                "payment": {
                    "id": payment.id,
                    "status": payment.status
                }
            })
        
        elif request.method == "DELETE":
            payment.delete()
            return JsonResponse({
                "status": "success",
                "message": "Платеж удален"
            })
        
        elif request.method == "PUT":
            # Полное обновление
            data = json.loads(request.body)
            payment.amount = data.get('amount', payment.amount)
            payment.next_charge_date = datetime.strptime(
                data.get('next_charge_date', payment.next_charge_date.strftime("%Y-%m-%d")),
                "%Y-%m-%d"
            ).date()
            payment.save()
            
            return JsonResponse({
                "status": "success",
                "message": "Платеж обновлен",
                "payment": {
                    "id": payment.id,
                    "amount": float(payment.amount),
                    "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d")
                }
            })
            
    except RecurringPayment.DoesNotExist:
        return JsonResponse({
            "status": "error",
            "message": "Платеж не найден"
        }, status=404)
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=400)

@extend_schema(
    summary="Оплатить пропущенный платеж",
    description="Списывает средства со счета для погашения задолженности. Возвращает ошибку 402 при недостатке средств.",
    tags=["Payments"],
    parameters=[
        OpenApiParameter(
            name='payment_id',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description='ID платежа для оплаты',
        ),
    ],
    responses={
        200: {'description': 'Платеж успешно оплачен'},
        402: {'description': 'Недостаточно средств'},
        404: {'description': 'Платеж не найден'}
    }
)
@csrf_exempt
@require_http_methods(["POST"])
def pay_payment(request, payment_id):
    """
    Task 2.5: Оплата пропущенного платежа
    POST /api/v1/payments/{id}/pay
    Имитация списания средств с счета для погашения задолженности
    """
    try:
        payment = RecurringPayment.objects.get(id=payment_id)
        user = payment.user
        
        # Получаем счет пользователя
        account = Account.objects.filter(user=user).first()
        if not account:
            return JsonResponse({
                "status": "error",
                "message": "Счет не найден"
            }, status=404)
        
        # Проверяем баланс
        if account.balance < payment.amount:
            return JsonResponse({
                "status": "error",
                "message": "Недостаточно средств на счете",
                "error_code": "INSUFFICIENT_FUNDS",
                "current_balance": float(account.balance),
                "required_amount": float(payment.amount)
            }, status=402)  # 402 Payment Required
        
        # ИМИТАЦИЯ СПИСАНИЯ (в реальности здесь был бы вызов Core Banking API)
        # Списываем средства со счета
        account.balance -= payment.amount
        account.save()
        
        # Создаем запись о транзакции
        from api.models import Transaction
        Transaction.objects.create(
            account=account,
            merchant_name=payment.service.name if payment.service else payment.custom_name,
            amount=payment.amount,
            transaction_date=datetime.now(),
            status='completed'
        )
        
        # Обновляем статус платежа
        payment.status = 'paid'
        payment.save()
        
        return JsonResponse({
            "status": "success",
            "message": "Платеж успешно оплачен",
            "data": {
                "payment_id": payment.id,
                "service_name": payment.service.name if payment.service else payment.custom_name,
                "amount": float(payment.amount),
                "new_balance": float(account.balance),
                "transaction_id": 1  # В реальности здесь был бы ID созданной транзакции
            }
        })
        
    except RecurringPayment.DoesNotExist:
        return JsonResponse({
            "status": "error",
            "message": "Платеж не найден"
        }, status=404)
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=400)
        
        
        
@csrf_exempt
@require_http_methods(["POST"])
def analyze_and_create_payments(request):
    user_id = 1
    user = User.objects.get(internal_id=f"user_{user_id}")
    
    patterns = find_recurring_patterns(user, months=3)
    created = create_recurring_payments_from_patterns(user, patterns)
    
    return JsonResponse({
        "status": "success",
        "patterns_found": len(patterns),
        "payments_created": created
    })
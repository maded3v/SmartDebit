from datetime import datetime
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from api.models import (
    ServiceDictionary, RecurringPayment, User, Account,
    Notification, Transaction
)
from api.services.parser import (
    find_recurring_patterns, create_recurring_payments_from_patterns
)
from api.serializers import (
    PaymentCreateSerializer, PaymentStatusSerializer,
    ToggleSmartDebitSerializer
)

def get_mock_dashboard_data(user_id):
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

@extend_schema(
    summary="Получить список сервисов",
    description="Возвращает все сервисы из справочника SERVICE_DICTIONARY",
    tags=["SmartDebit"],
)
@api_view(["GET"])
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
    return Response({"status": "success", "services": data})

@extend_schema(
    summary="Дашборд SmartDebit",
    description="Возвращает баланс, предстоящие платежи, алерты и аналитику",
    tags=["SmartDebit"],
)
@api_view(["GET"])
def get_dashboard(request):
    user_id = 1
    user = User.objects.filter(internal_id=f"user_{user_id}").first()
    if not user:
        return Response(
            {"status": "error", "message": "User not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
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

    return Response({
        "status": "success",
        "data": {
            "is_smartdebit_enabled": user.is_smartdebit_enabled,
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
@api_view(["POST"])
def toggle_smartdebit(request):
    try:
        serializer = ToggleSmartDebitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_id = serializer.validated_data['user_id']
        enabled = serializer.validated_data['enabled']
        
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
        
        return Response({
            "status": "success",
            "message": f"SmartDebit {'включен' if enabled else 'выключен'}",
            "data": {
                "user_id": user.internal_id,
                "is_smartdebit_enabled": user.is_smartdebit_enabled,
                "patterns_analyzed": analyzed_count
            }
        })
    except Exception as e:
        return Response(
            {"status": "error", "message": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

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
@api_view(["GET", "POST"])
def payments_list_create(request):
    if request.method == "GET":
        user_id = request.GET.get('user_id', 1)
        user = User.objects.filter(internal_id=f"user_{user_id}").first()
        if not user:
            return Response(
                {"status": "error", "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
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
        return Response({"status": "success", "payments": data})

    elif request.method == "POST":
        try:
            serializer = PaymentCreateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {"status": "error", "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user_id = serializer.validated_data.get('user_id', 1)
            user = User.objects.get(internal_id=f"user_{user_id}")
            
            service_id = serializer.validated_data.get('service_id')
            service = ServiceDictionary.objects.get(id=service_id) if service_id else None
            
            payment = RecurringPayment.objects.create(
                user=user,
                service=service,
                custom_name=serializer.validated_data['custom_name'],
                amount=serializer.validated_data['amount'],
                next_charge_date=serializer.validated_data['next_charge_date'],
                status='active'
            )
            
            return Response({
                "status": "success",
                "message": "Платеж создан",
                "payment": {
                    "id": payment.id,
                    "service_name": service.name if service else payment.custom_name,
                    "amount": float(payment.amount),
                    "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d"),
                    "status": payment.status
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

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
@api_view(["PATCH", "DELETE", "PUT"])
def payment_detail(request, payment_id):
    try:
        payment = RecurringPayment.objects.get(id=payment_id)
        
        if request.method == "PATCH":
            serializer = PaymentStatusSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {"status": "error", "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            new_status = serializer.validated_data['status']

            if payment.service and payment.service.is_mandatory and new_status in ['cancelled', 'frozen']:
                return Response({
                    "status": "error",
                    "message": "Нельзя отключить обязательный платеж",
                    "error_code": "MANDATORY_PAYMENT"
                }, status=status.HTTP_403_FORBIDDEN)

            payment.status = new_status
            payment.save()
            
            return Response({
                "status": "success",
                "message": f"Статус изменен на {new_status}",
                "payment": {
                    "id": payment.id,
                    "status": payment.status
                }
            })
        
        elif request.method == "DELETE":
            payment.delete()
            return Response({"status": "success", "message": "Платеж удален"})
        
        elif request.method == "PUT":
            data = request.data
            payment.amount = data.get('amount', payment.amount)
            payment.next_charge_date = datetime.strptime(
                data.get('next_charge_date', payment.next_charge_date.strftime("%Y-%m-%d")),
                "%Y-%m-%d"
            ).date()
            payment.save()
            
            return Response({
                "status": "success",
                "message": "Платеж обновлен",
                "payment": {
                    "id": payment.id,
                    "amount": float(payment.amount),
                    "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d")
                }
            })
            
    except RecurringPayment.DoesNotExist:
        return Response(
            {"status": "error", "message": "Платеж не найден"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"status": "error", "message": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

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
@api_view(["POST"])
def pay_payment(request, payment_id):
    try:
        payment = RecurringPayment.objects.get(id=payment_id)
        user = payment.user
        
        account = Account.objects.filter(user=user).first()
        if not account:
            return Response(
                {"status": "error", "message": "Счет не найден"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if account.balance < payment.amount:
            return Response({
                "status": "error",
                "message": "Недостаточно средств на счете",
                "error_code": "INSUFFICIENT_FUNDS",
                "current_balance": float(account.balance),
                "required_amount": float(payment.amount)
            }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        account.balance -= payment.amount
        account.save()
        
        transaction = Transaction.objects.create(
            account=account,
            merchant_name=payment.service.name if payment.service else payment.custom_name,
            amount=payment.amount,
            transaction_date=datetime.now(),
            status='completed'
        )
        
        payment.status = 'paid'
        payment.save()
        
        return Response({
            "status": "success",
            "message": "Платеж успешно оплачен",
            "data": {
                "payment_id": payment.id,
                "service_name": payment.service.name if payment.service else payment.custom_name,
                "amount": float(payment.amount),
                "new_balance": float(account.balance),
                "transaction_id": transaction.id
            }
        })
        
    except RecurringPayment.DoesNotExist:
        return Response(
            {"status": "error", "message": "Платеж не найден"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"status": "error", "message": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

@extend_schema(
    summary="Анализ и создание платежей",
    description="Анализирует транзакции пользователя и создает регулярные платежи",
    tags=["SmartDebit"],
)
@api_view(["POST"])
def analyze_and_create_payments(request):
    user_id = 1
    user = User.objects.get(internal_id=f"user_{user_id}")
    patterns = find_recurring_patterns(user, months=3)
    created = create_recurring_payments_from_patterns(user, patterns)
    return Response({
        "status": "success",
        "patterns_found": len(patterns),
        "payments_created": created
    })

@extend_schema(
    summary="Получить уведомления пользователя",
    description="Возвращает последние 20 уведомлений",
    tags=["Notifications"],
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
@api_view(["GET"])
def get_notifications(request):
    user_id = request.GET.get('user_id', 1)
    user = User.objects.filter(internal_id=f"user_{user_id}").first()
    if not user:
        return Response(
            {"status": "error", "message": "User not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    notifications = Notification.objects.filter(
        user=user
    ).select_related('payment__service').order_by('-created_at')[:20]
    
    data = [
        {
            "id": n.id,
            "message": n.message,
            "type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
            "payment_id": n.payment.id if n.payment else None
        } for n in notifications
    ]
    
    return Response({"status": "success", "notifications": data})

@extend_schema(
    summary="Health Check",
    description="Проверка здоровья сервиса",
    tags=["System"],
)
@api_view(["GET"])
def health_check(request):
    try:
        connection.ensure_connection()
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {str(e)}"
    
    return Response({
        "status": "ok",
        "service": "smartdebit-backend",
        "database": db_status,
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    })
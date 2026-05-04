from datetime import datetime

from django.db import connection
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.models import (
    Account, Notification, RecurringPayment, ServiceDictionary, Transaction, User,
)
from api.serializers import (
    PaymentCreateSerializer, PaymentStatusSerializer, ToggleSmartDebitSerializer,
)
from api.services.parser import find_recurring_patterns, create_recurring_payments_from_patterns


def _get_api_user(request):
    try:
        return request.user.api_profile
    except User.DoesNotExist:
        return None


CATEGORY_MAP = {
    'Развлечения': 'entertainment',
    'Кино': 'entertainment',
    'Подписки': 'entertainment',
    'ЖКХ': 'utilities',
    'Кредиты': 'finance',
}


@extend_schema(
    summary="Получить список сервисов",
    description="Возвращает все сервисы из справочника SERVICE_DICTIONARY",
    tags=["SmartDebit"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def get_services(request):
    services_qs = ServiceDictionary.objects.all()
    data = [
        {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "is_mandatory": s.is_mandatory,
        }
        for s in services_qs
    ]
    return Response({"status": "success", "services": data})


@extend_schema(
    summary="Дашборд SmartDebit",
    description="Возвращает баланс, предстоящие платежи, алерты и аналитику",
    tags=["SmartDebit"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_dashboard(request):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    account = Account.objects.filter(user=user).first()
    balance = float(account.balance) if account else 0.0

    if not user.is_smartdebit_enabled:
        return Response({
            "status": "success",
            "data": {
                "is_smartdebit_enabled": False,
                "balance": balance,
                "currency": "RUB",
                "upcoming_payments": [],
                "alerts": [],
                "analytics": {"entertainment": 0, "utilities": 0, "finance": 0},
            },
        })

    upcoming_qs = RecurringPayment.objects.filter(
        user=user,
        status__in=['active', 'low_balance'],
    ).select_related('service').order_by('next_charge_date')[:5]

    upcoming = [
        {
            "id": p.id,
            "service_name": p.service.name if p.service else p.custom_name,
            "amount": float(p.amount),
            "next_charge_date": p.next_charge_date.strftime("%Y-%m-%d"),
            "category": p.service.category if p.service else "Other",
            "is_mandatory": p.service.is_mandatory if p.service else False,
            "status": p.status,
        }
        for p in upcoming_qs
    ]

    alerts = []
    for p in upcoming_qs:
        if p.status == 'low_balance' or (account and account.balance < p.amount):
            alerts.append({
                "id": p.id,
                "service_name": p.service.name if p.service else p.custom_name,
                "message": "Недостаточно средств для списания" if account and account.balance < p.amount else "Предстоящий платеж",
                "amount": float(p.amount),
                "type": "low_balance" if account and account.balance < p.amount else "upcoming",
            })

    all_active = RecurringPayment.objects.filter(
        user=user,
        status__in=['active', 'low_balance'],
    ).select_related('service')

    analytics = {"entertainment": 0, "utilities": 0, "finance": 0}
    for p in all_active:
        cat = p.service.category if p.service else "Other"
        key = CATEGORY_MAP.get(cat)
        if key:
            analytics[key] += float(p.amount)

    return Response({
        "status": "success",
        "data": {
            "is_smartdebit_enabled": user.is_smartdebit_enabled,
            "balance": balance,
            "currency": "RUB",
            "upcoming_payments": upcoming,
            "alerts": alerts,
            "analytics": analytics,
        },
    })


@extend_schema(
    summary="Активация SmartDebit",
    description="Включает или выключает функцию SmartDebit для текущего пользователя",
    tags=["SmartDebit"],
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_smartdebit(request):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = ToggleSmartDebitSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    enabled = serializer.validated_data['enabled']
    user.is_smartdebit_enabled = enabled
    user.save(update_fields=['is_smartdebit_enabled'])

    analyzed_count = 0
    if enabled:
        patterns = find_recurring_patterns(user, months=3)
        analyzed_count = create_recurring_payments_from_patterns(user, patterns)

    return Response({
        "status": "success",
        "message": f"SmartDebit {'включен' if enabled else 'выключен'}",
        "data": {
            "is_smartdebit_enabled": user.is_smartdebit_enabled,
            "patterns_analyzed": analyzed_count,
        },
    })


@extend_schema(
    summary="Управление платежами",
    description="GET: Список всех платежей пользователя\nPOST: Создание нового регулярного платежа",
    tags=["Payments"],
)
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def payments_list_create(request):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        payments = RecurringPayment.objects.filter(user=user).select_related('service')
        data = [
            {
                "id": p.id,
                "service_name": p.service.name if p.service else p.custom_name,
                "amount": float(p.amount),
                "next_charge_date": p.next_charge_date.strftime("%Y-%m-%d"),
                "category": p.service.category if p.service else "Other",
                "is_mandatory": p.service.is_mandatory if p.service else False,
                "status": p.status,
            }
            for p in payments
        ]
        return Response({"status": "success", "payments": data})

    serializer = PaymentCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    service_id = serializer.validated_data.get('service_id')
    service = ServiceDictionary.objects.filter(id=service_id).first() if service_id else None

    payment = RecurringPayment.objects.create(
        user=user,
        service=service,
        custom_name=serializer.validated_data['custom_name'],
        amount=serializer.validated_data['amount'],
        next_charge_date=serializer.validated_data['next_charge_date'],
        status='active',
    )

    return Response(
        {
            "status": "success",
            "message": "Платеж создан",
            "payment": {
                "id": payment.id,
                "service_name": service.name if service else payment.custom_name,
                "amount": float(payment.amount),
                "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d"),
                "status": payment.status,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    summary="Детали платежа",
    description="GET: Получить платёж\nPATCH: Изменить статус\nDELETE: Удалить\nPUT: Обновить сумму и дату",
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
@api_view(["GET", "PATCH", "DELETE", "PUT"])
@permission_classes([IsAuthenticated])
def payment_detail(request, payment_id):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        payment = RecurringPayment.objects.select_related('service').get(id=payment_id, user=user)
    except RecurringPayment.DoesNotExist:
        return Response(
            {"status": "error", "message": "Платеж не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response({
            "status": "success",
            "payment": {
                "id": payment.id,
                "service_name": payment.service.name if payment.service else payment.custom_name,
                "amount": float(payment.amount),
                "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d"),
                "category": payment.service.category if payment.service else "Other",
                "is_mandatory": payment.service.is_mandatory if payment.service else False,
                "status": payment.status,
            },
        })

    if request.method == "PATCH":
        serializer = PaymentStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_status = serializer.validated_data['status']

        if payment.service and payment.service.is_mandatory and new_status in ['cancelled', 'frozen']:
            return Response(
                {
                    "status": "error",
                    "message": "Нельзя отключить обязательный платеж",
                    "error_code": "MANDATORY_PAYMENT",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        payment.status = new_status
        payment.save(update_fields=['status'])

        return Response({
            "status": "success",
            "message": f"Статус изменен на {new_status}",
            "payment": {"id": payment.id, "status": payment.status},
        })

    if request.method == "DELETE":
        payment.delete()
        return Response({"status": "success", "message": "Платеж удален"})

    if request.method == "PUT":
        payment.amount = request.data.get('amount', payment.amount)
        raw_date = request.data.get('next_charge_date', payment.next_charge_date.strftime("%Y-%m-%d"))
        payment.next_charge_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        payment.save(update_fields=['amount', 'next_charge_date'])

        return Response({
            "status": "success",
            "message": "Платеж обновлен",
            "payment": {
                "id": payment.id,
                "amount": float(payment.amount),
                "next_charge_date": payment.next_charge_date.strftime("%Y-%m-%d"),
            },
        })


@extend_schema(
    summary="Оплатить пропущенный платеж",
    description="Списывает средства со счета. Возвращает 402 при недостатке средств.",
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
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pay_payment(request, payment_id):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        payment = RecurringPayment.objects.select_related('service').get(id=payment_id, user=user)
    except RecurringPayment.DoesNotExist:
        return Response(
            {"status": "error", "message": "Платеж не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    account = Account.objects.filter(user=user).first()
    if not account:
        return Response(
            {"status": "error", "message": "Счет не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if account.balance < payment.amount:
        return Response(
            {
                "status": "error",
                "message": "Недостаточно средств на счете",
                "error_code": "INSUFFICIENT_FUNDS",
                "current_balance": float(account.balance),
                "required_amount": float(payment.amount),
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    account.balance -= payment.amount
    account.save(update_fields=['balance'])

    transaction = Transaction.objects.create(
        account=account,
        merchant_name=payment.service.name if payment.service else payment.custom_name,
        amount=payment.amount,
        transaction_date=datetime.now(),
        status='completed',
    )

    payment.status = 'paid'
    payment.save(update_fields=['status'])

    return Response({
        "status": "success",
        "message": "Платеж успешно оплачен",
        "data": {
            "payment_id": payment.id,
            "service_name": payment.service.name if payment.service else payment.custom_name,
            "amount": float(payment.amount),
            "new_balance": float(account.balance),
            "transaction_id": transaction.id,
        },
    })


@extend_schema(
    summary="Анализ и создание платежей",
    description="Анализирует транзакции и создает регулярные платежи",
    tags=["SmartDebit"],
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def analyze_and_create_payments(request):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    patterns = find_recurring_patterns(user, months=3)
    created = create_recurring_payments_from_patterns(user, patterns)
    return Response({
        "status": "success",
        "patterns_found": len(patterns),
        "payments_created": created,
    })


@extend_schema(
    summary="Получить уведомления",
    description="Возвращает последние 20 уведомлений текущего пользователя",
    tags=["Notifications"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    notifications = Notification.objects.filter(
        user=user,
    ).select_related('payment__service').order_by('-created_at')[:20]

    data = [
        {
            "id": n.id,
            "message": n.message,
            "type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
            "payment_id": n.payment.id if n.payment else None,
        }
        for n in notifications
    ]

    return Response({"status": "success", "notifications": data})


@extend_schema(
    summary="Пометить уведомление как прочитанное",
    tags=["Notifications"],
    parameters=[
        OpenApiParameter(
            name='notification_id',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
        ),
    ],
)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    user = _get_api_user(request)
    if not user:
        return Response(
            {"status": "error", "message": "Профиль не найден"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        notification = Notification.objects.get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response(
            {"status": "error", "message": "Уведомление не найдено"},
            status=status.HTTP_404_NOT_FOUND,
        )

    notification.is_read = True
    notification.save(update_fields=['is_read'])

    return Response({"status": "success", "id": notification.id, "is_read": True})


@extend_schema(summary="Health Check", tags=["System"])
@api_view(["GET"])
@permission_classes([AllowAny])
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
        "timestamp": datetime.now().isoformat(),
    })

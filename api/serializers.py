from rest_framework import serializers
from datetime import date
from decimal import Decimal


class ToggleSmartDebitSerializer(serializers.Serializer):
    '''Для включения/выключения SmartDebit.'''
    user_id = serializers.IntegerField(default=1)
    enabled = serializers.BooleanField(default=True)


class PaymentCreateSerializer(serializers.Serializer):
    '''Для создания нового платежа.'''
    user_id = serializers.IntegerField(default=1)
    service_id = serializers.IntegerField(required=False, allow_null=True)
    custom_name = serializers.CharField(
        required=False,
        allow_blank=True,
        default=''
    )
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01')
    )
    next_charge_date = serializers.DateField()

    def validate_next_charge_date(self, value):
        if value < date.today():
            raise serializers.ValidationError("Дата не может быть в прошлом")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Сумма должна быть больше нуля")
        return value


class PaymentStatusSerializer(serializers.Serializer):
    '''Для смены статуса платежа.'''
    status = serializers.ChoiceField(choices=['active', 'frozen', 'cancelled'])

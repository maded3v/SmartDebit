from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User as AuthUser
from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    password = serializers.CharField(min_length=6, write_only=True)

    def validate_username(self, value):
        if AuthUser.objects.filter(username=value).exists():
            raise serializers.ValidationError('Пользователь с таким логином уже существует')
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ToggleSmartDebitSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(default=True)


class PaymentCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(required=False, allow_null=True)
    custom_name = serializers.CharField(required=False, allow_blank=True, default='')
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    next_charge_date = serializers.DateField()

    def validate_next_charge_date(self, value):
        if value < date.today():
            raise serializers.ValidationError('Дата не может быть в прошлом')
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Сумма должна быть больше нуля')
        return value


class PaymentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['active', 'frozen', 'cancelled'])

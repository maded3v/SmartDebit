from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth.models import User as AuthUser
from django.test import TestCase
from django.utils import timezone

from api.models import Account, Notification, RecurringPayment, ServiceDictionary, Transaction, User
from api.serializers import (
    LoginSerializer, PaymentCreateSerializer, PaymentStatusSerializer,
    RegisterSerializer, ToggleSmartDebitSerializer,
)
from api.services.cron_jobs import daily_alert_generator, low_balance_checker, missed_payment_detector
from api.services.parser import predict_next_charge_date


class PredictNextChargeDateTest(TestCase):
    def test_regular_date(self):
        last_date = date(2026, 1, 15)
        next_date = predict_next_charge_date(last_date, 30)
        self.assertEqual(next_date, date(2026, 2, 16))

    def test_leap_year_february(self):
        last_date = date(2024, 1, 30)
        next_date = predict_next_charge_date(last_date, 30)
        self.assertEqual(next_date, date(2024, 2, 29))

    def test_weekend_shift(self):
        last_date = date(2026, 4, 10)
        next_date = predict_next_charge_date(last_date, 30)
        self.assertTrue(next_date.weekday() < 5)

    def test_30_days_interval(self):
        last_date = date(2026, 3, 1)
        next_date = predict_next_charge_date(last_date, 30)
        self.assertGreaterEqual(next_date, last_date + timedelta(days=30))

    def test_result_is_date_object(self):
        result = predict_next_charge_date(date(2026, 1, 1), 30)
        self.assertIsInstance(result, date)


class MandatoryPaymentProtectionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='test_user_1')
        self.optional_service = ServiceDictionary.objects.create(
            name='Яндекс Плюс',
            category='Развлечения',
            is_mandatory=False,
        )
        self.mandatory_service = ServiceDictionary.objects.create(
            name='ЖКХ',
            category='Коммунальные',
            is_mandatory=True,
        )

    def test_can_cancel_optional(self):
        payment = RecurringPayment.objects.create(
            user=self.user,
            service=self.optional_service,
            amount=Decimal('299.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        payment.status = 'cancelled'
        payment.save(update_fields=['status'])
        self.assertEqual(payment.status, 'cancelled')

    def test_mandatory_service_flag(self):
        self.assertTrue(self.mandatory_service.is_mandatory)

    def test_optional_service_flag(self):
        self.assertFalse(self.optional_service.is_mandatory)

    def test_payment_created_with_active_status(self):
        payment = RecurringPayment.objects.create(
            user=self.user,
            service=self.optional_service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() + timedelta(days=5),
            status='active',
        )
        self.assertEqual(payment.status, 'active')


class RegisterSerializerTest(TestCase):
    def test_valid_data(self):
        serializer = RegisterSerializer(data={'username': 'testuser', 'password': 'pass123'})
        self.assertTrue(serializer.is_valid())

    def test_short_username_rejected(self):
        serializer = RegisterSerializer(data={'username': 'ab', 'password': 'pass123'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)

    def test_short_password_rejected(self):
        serializer = RegisterSerializer(data={'username': 'testuser', 'password': '123'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)

    def test_duplicate_username_rejected(self):
        AuthUser.objects.create_user(username='existing', password='pass123')
        serializer = RegisterSerializer(data={'username': 'existing', 'password': 'pass123'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)


class LoginSerializerTest(TestCase):
    def test_valid_data(self):
        serializer = LoginSerializer(data={'username': 'user', 'password': 'pass'})
        self.assertTrue(serializer.is_valid())

    def test_missing_password(self):
        serializer = LoginSerializer(data={'username': 'user'})
        self.assertFalse(serializer.is_valid())


class ToggleSmartDebitSerializerTest(TestCase):
    def test_valid_data(self):
        serializer = ToggleSmartDebitSerializer(data={'enabled': True})
        self.assertTrue(serializer.is_valid())

    def test_defaults(self):
        serializer = ToggleSmartDebitSerializer(data={})
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['enabled'], True)

    def test_enabled_false(self):
        serializer = ToggleSmartDebitSerializer(data={'enabled': False})
        self.assertTrue(serializer.is_valid())
        self.assertFalse(serializer.validated_data['enabled'])


class PaymentCreateSerializerTest(TestCase):
    def valid_data(self):
        return {
            'amount': '299.00',
            'next_charge_date': (date.today() + timedelta(days=1)).isoformat(),
        }

    def test_valid_data(self):
        serializer = PaymentCreateSerializer(data=self.valid_data())
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_past_date_rejected(self):
        payload = self.valid_data()
        payload['next_charge_date'] = (date.today() - timedelta(days=1)).isoformat()
        serializer = PaymentCreateSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn('next_charge_date', serializer.errors)

    def test_zero_amount_rejected(self):
        payload = self.valid_data()
        payload['amount'] = '0.00'
        serializer = PaymentCreateSerializer(data=payload)
        self.assertFalse(serializer.is_valid())

    def test_negative_amount_rejected(self):
        payload = self.valid_data()
        payload['amount'] = '-100.00'
        serializer = PaymentCreateSerializer(data=payload)
        self.assertFalse(serializer.is_valid())

    def test_today_date_allowed(self):
        payload = self.valid_data()
        payload['next_charge_date'] = date.today().isoformat()
        serializer = PaymentCreateSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_custom_name_optional(self):
        serializer = PaymentCreateSerializer(data=self.valid_data())
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['custom_name'], '')

    def test_amount_as_decimal(self):
        serializer = PaymentCreateSerializer(data=self.valid_data())
        serializer.is_valid()
        self.assertIsInstance(serializer.validated_data['amount'], Decimal)


class PaymentStatusSerializerTest(TestCase):
    def test_active_valid(self):
        serializer = PaymentStatusSerializer(data={'status': 'active'})
        self.assertTrue(serializer.is_valid())

    def test_frozen_valid(self):
        serializer = PaymentStatusSerializer(data={'status': 'frozen'})
        self.assertTrue(serializer.is_valid())

    def test_cancelled_valid(self):
        serializer = PaymentStatusSerializer(data={'status': 'cancelled'})
        self.assertTrue(serializer.is_valid())

    def test_invalid_status(self):
        serializer = PaymentStatusSerializer(data={'status': 'deleted'})
        self.assertFalse(serializer.is_valid())

    def test_empty_status(self):
        serializer = PaymentStatusSerializer(data={})
        self.assertFalse(serializer.is_valid())


class DailyAlertGeneratorTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='cron_user_1')
        self.service = ServiceDictionary.objects.create(
            name='Netflix',
            category='Развлечения',
            is_mandatory=False,
        )

    def test_returns_list(self):
        result = daily_alert_generator()
        self.assertIsInstance(result, list)

    def test_alert_created_for_tomorrow_payment(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        result = daily_alert_generator()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['service_name'], 'Netflix')

    def test_no_alert_for_today_payment(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today(),
            status='active',
        )
        result = daily_alert_generator()
        self.assertEqual(len(result), 0)

    def test_notification_saved_to_db(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        daily_alert_generator()
        self.assertEqual(Notification.objects.filter(notification_type='upcoming').count(), 1)

    def test_no_duplicate_notification(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        daily_alert_generator()
        daily_alert_generator()
        self.assertEqual(Notification.objects.filter(notification_type='upcoming').count(), 1)

    def test_frozen_payment_skipped(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='frozen',
        )
        result = daily_alert_generator()
        self.assertEqual(len(result), 0)


class LowBalanceCheckerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='cron_user_2')
        self.service = ServiceDictionary.objects.create(
            name='Spotify',
            category='Развлечения',
            is_mandatory=False,
        )
        self.account = Account.objects.create(user=self.user, balance=Decimal('100.00'))

    def test_returns_list(self):
        result = low_balance_checker()
        self.assertIsInstance(result, list)

    def test_low_balance_detected(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('500.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        result = low_balance_checker()
        self.assertEqual(len(result), 1)

    def test_sufficient_balance_skipped(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('50.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        result = low_balance_checker()
        self.assertEqual(len(result), 0)

    def test_status_changed_to_low_balance(self):
        payment = RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('500.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        low_balance_checker()
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'low_balance')

    def test_notification_saved_to_db(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('500.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active',
        )
        low_balance_checker()
        self.assertEqual(Notification.objects.filter(notification_type='low_balance').count(), 1)


class MissedPaymentDetectorTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='cron_user_3')
        self.service = ServiceDictionary.objects.create(
            name='Apple Music',
            category='Развлечения',
            is_mandatory=False,
        )
        self.account = Account.objects.create(user=self.user, balance=Decimal('1000.00'))

    def test_returns_list(self):
        result = missed_payment_detector()
        self.assertIsInstance(result, list)

    def test_missed_payment_detected(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active',
        )
        result = missed_payment_detector()
        self.assertEqual(len(result), 1)

    def test_no_missed_if_transaction_exists(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active',
        )
        Transaction.objects.create(
            account=self.account,
            merchant_name='Apple Music',
            amount=Decimal('199.00'),
            transaction_date=timezone.make_aware(
                datetime.combine(date.today() - timedelta(days=1), datetime.min.time())
            ),
            status='completed',
        )
        result = missed_payment_detector()
        self.assertEqual(len(result), 0)

    def test_status_changed_on_missed(self):
        payment = RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active',
        )
        missed_payment_detector()
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'low_balance')

    def test_notification_saved_on_missed(self):
        RecurringPayment.objects.create(
            user=self.user,
            service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active',
        )
        missed_payment_detector()
        self.assertEqual(Notification.objects.filter(notification_type='missed').count(), 1)

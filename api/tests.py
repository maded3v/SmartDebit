from django.test import TestCase
from datetime import date, timedelta
from decimal import Decimal
from api.models import User, Account, ServiceDictionary, RecurringPayment, Notification, Transaction
from api.services.parser import predict_next_charge_date
from api.services.cron_jobs import daily_alert_generator, low_balance_checker, missed_payment_detector
from api.serializers import ToggleSmartDebitSerializer, PaymentCreateSerializer, PaymentStatusSerializer


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
            is_mandatory=False
        )
        self.mandatory_service = ServiceDictionary.objects.create(
            name='ЖКХ',
            category='Коммунальные',
            is_mandatory=True
        )

    def test_can_cancel_optional(self):
        payment = RecurringPayment.objects.create(
            user=self.user,
            service=self.optional_service,
            amount=Decimal('299.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        payment.status = 'cancelled'
        payment.save()
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
            status='active'
        )
        self.assertEqual(payment.status, 'active')


class ToggleSmartDebitSerializerTest(TestCase):
    def test_valid_data(self):
        s = ToggleSmartDebitSerializer(data={'user_id': 1, 'enabled': True})
        self.assertTrue(s.is_valid())

    def test_defaults(self):
        s = ToggleSmartDebitSerializer(data={})
        self.assertTrue(s.is_valid())
        self.assertEqual(s.validated_data['user_id'], 1)
        self.assertEqual(s.validated_data['enabled'], True)

    def test_enabled_false(self):
        s = ToggleSmartDebitSerializer(data={'user_id': 2, 'enabled': False})
        self.assertTrue(s.is_valid())
        self.assertFalse(s.validated_data['enabled'])

    def test_invalid_user_id(self):
        s = ToggleSmartDebitSerializer(data={'user_id': 'abc', 'enabled': True})
        self.assertFalse(s.is_valid())


class PaymentCreateSerializerTest(TestCase):
    def _valid_data(self):
        return {
            'user_id': 1,
            'amount': '299.00',
            'next_charge_date': (date.today() + timedelta(days=1)).isoformat()
        }

    def test_valid_data(self):
        s = PaymentCreateSerializer(data=self._valid_data())
        self.assertTrue(s.is_valid(), s.errors)

    def test_past_date_rejected(self):
        data = self._valid_data()
        data['next_charge_date'] = (date.today() - timedelta(days=1)).isoformat()
        s = PaymentCreateSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('next_charge_date', s.errors)

    def test_zero_amount_rejected(self):
        data = self._valid_data()
        data['amount'] = '0.00'
        s = PaymentCreateSerializer(data=data)
        self.assertFalse(s.is_valid())

    def test_negative_amount_rejected(self):
        data = self._valid_data()
        data['amount'] = '-100.00'
        s = PaymentCreateSerializer(data=data)
        self.assertFalse(s.is_valid())

    def test_today_date_allowed(self):
        data = self._valid_data()
        data['next_charge_date'] = date.today().isoformat()
        s = PaymentCreateSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)

    def test_custom_name_optional(self):
        data = self._valid_data()
        s = PaymentCreateSerializer(data=data)
        self.assertTrue(s.is_valid())
        self.assertEqual(s.validated_data['custom_name'], '')

    def test_service_id_optional(self):
        data = self._valid_data()
        s = PaymentCreateSerializer(data=data)
        self.assertTrue(s.is_valid())
        self.assertIsNone(s.validated_data.get('service_id'))

    def test_amount_as_decimal(self):
        s = PaymentCreateSerializer(data=self._valid_data())
        s.is_valid()
        self.assertIsInstance(s.validated_data['amount'], Decimal)


class PaymentStatusSerializerTest(TestCase):
    def test_active_valid(self):
        s = PaymentStatusSerializer(data={'status': 'active'})
        self.assertTrue(s.is_valid())

    def test_frozen_valid(self):
        s = PaymentStatusSerializer(data={'status': 'frozen'})
        self.assertTrue(s.is_valid())

    def test_cancelled_valid(self):
        s = PaymentStatusSerializer(data={'status': 'cancelled'})
        self.assertTrue(s.is_valid())

    def test_invalid_status(self):
        s = PaymentStatusSerializer(data={'status': 'deleted'})
        self.assertFalse(s.is_valid())

    def test_empty_status(self):
        s = PaymentStatusSerializer(data={})
        self.assertFalse(s.is_valid())


class DailyAlertGeneratorTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='cron_user_1')
        self.service = ServiceDictionary.objects.create(
            name='Netflix', category='Развлечения', is_mandatory=False
        )

    def test_returns_list(self):
        result = daily_alert_generator()
        self.assertIsInstance(result, list)

    def test_alert_created_for_tomorrow_payment(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        result = daily_alert_generator()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['service_name'], 'Netflix')

    def test_no_alert_for_today_payment(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today(),
            status='active'
        )
        result = daily_alert_generator()
        self.assertEqual(len(result), 0)

    def test_notification_saved_to_db(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        daily_alert_generator()
        self.assertEqual(Notification.objects.filter(notification_type='upcoming').count(), 1)

    def test_frozen_payment_skipped(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('599.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='frozen'
        )
        result = daily_alert_generator()
        self.assertEqual(len(result), 0)


class LowBalanceCheckerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='cron_user_2')
        self.service = ServiceDictionary.objects.create(
            name='Spotify', category='Развлечения', is_mandatory=False
        )
        self.account = Account.objects.create(
            user=self.user, balance=Decimal('100.00')
        )

    def test_returns_list(self):
        result = low_balance_checker()
        self.assertIsInstance(result, list)

    def test_low_balance_detected(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('500.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        result = low_balance_checker()
        self.assertEqual(len(result), 1)

    def test_sufficient_balance_skipped(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('50.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        result = low_balance_checker()
        self.assertEqual(len(result), 0)

    def test_status_changed_to_low_balance(self):
        payment = RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('500.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        low_balance_checker()
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'low_balance')

    def test_notification_saved_to_db(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('500.00'),
            next_charge_date=date.today() + timedelta(days=1),
            status='active'
        )
        low_balance_checker()
        self.assertEqual(Notification.objects.filter(notification_type='low_balance').count(), 1)


class MissedPaymentDetectorTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='cron_user_3')
        self.service = ServiceDictionary.objects.create(
            name='Apple Music', category='Развлечения', is_mandatory=False
        )
        self.account = Account.objects.create(
            user=self.user, balance=Decimal('1000.00')
        )

    def test_returns_list(self):
        result = missed_payment_detector()
        self.assertIsInstance(result, list)

    def test_missed_payment_detected(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active'
        )
        result = missed_payment_detector()
        self.assertEqual(len(result), 1)

    def test_no_missed_if_transaction_exists(self):
        payment = RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active'
        )
        Transaction.objects.create(
            account=self.account,
            amount=Decimal('199.00'),
            transaction_date=date.today() - timedelta(days=1),
        )
        result = missed_payment_detector()
        self.assertEqual(len(result), 0)

    def test_status_changed_on_missed(self):
        payment = RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active'
        )
        missed_payment_detector()
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'low_balance')

    def test_notification_saved_on_missed(self):
        RecurringPayment.objects.create(
            user=self.user, service=self.service,
            amount=Decimal('199.00'),
            next_charge_date=date.today() - timedelta(days=1),
            status='active'
        )
        missed_payment_detector()
        self.assertEqual(Notification.objects.filter(notification_type='missed').count(), 1)

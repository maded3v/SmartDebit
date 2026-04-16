from django.test import TestCase
from datetime import date, timedelta
from api.models import User, Account, ServiceDictionary, RecurringPayment
from api.services.parser import predict_next_charge_date
from decimal import Decimal

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

class MandatoryPaymentProtectionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(internal_id='test_user_1')
        self.optional_service = ServiceDictionary.objects.create(
            name='Яндекс Плюс',
            category='Развлечения',
            is_mandatory=False
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
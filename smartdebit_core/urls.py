from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from api import views, views_auth

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/v1/auth/register/', views_auth.register, name='auth_register'),
    path('api/v1/auth/login/', views_auth.login_view, name='auth_login'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/me/', views.get_me, name='auth_me'),

    # SmartDebit
    path('api/v1/smartdebit/services/', views.get_services, name='get_services'),
    path('api/v1/smartdebit/dashboard/', views.get_dashboard, name='get_dashboard'),
    path('api/v1/smartdebit/toggle/', views.toggle_smartdebit, name='toggle_smartdebit'),
    path('api/v1/smartdebit/analyze/', views.analyze_and_create_payments, name='analyze_and_create_payments'),

    # Payments
    path('api/v1/payments/', views.payments_list_create, name='payments_list_create'),
    path('api/v1/payments/<int:payment_id>/', views.payment_detail, name='payment_detail'),
    path('api/v1/payments/<int:payment_id>/pay/', views.pay_payment, name='pay_payment'),
    path('api/v1/account/balance/adjust/', views.adjust_account_balance, name='adjust_account_balance'),

    # Transactions
    path('api/v1/transactions/', views.get_transactions, name='get_transactions'),

    # Notifications
    path('api/v1/notifications/', views.get_notifications, name='get_notifications'),
    path('api/v1/notifications/<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),

    # System
    path('api/health/', views.health_check, name='health_check'),

    # Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

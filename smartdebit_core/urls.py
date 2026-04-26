from django.contrib import admin
from django.urls import path
from api import views
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints - SmartDebit
    path('api/v1/smartdebit/services/', views.get_services, name='get_services'),
    path('api/v1/smartdebit/dashboard/', views.get_dashboard, name='get_dashboard'),
    path('api/v1/smartdebit/toggle/', views.toggle_smartdebit, name='toggle_smartdebit'),
    path('api/v1/smartdebit/analyze/', views.analyze_and_create_payments, name='analyze_and_create_payments'),

    # API endpoints - Payments
    path('api/v1/payments/', views.payments_list_create, name='payments_list_create'),
    path('api/v1/payments/<int:payment_id>/', views.payment_detail, name='payment_detail'),
    path('api/v1/payments/<int:payment_id>/pay', views.pay_payment, name='pay_payment'),

    # API endpoints - Notifications & Health (ДОБАВЛЕНЫ)
    path('api/v1/notifications/', views.get_notifications, name='get_notifications'),
    path('api/health/', views.health_check, name='health_check'),

    # Swagger документация
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
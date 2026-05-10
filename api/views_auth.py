from django.contrib.auth import authenticate
from django.contrib.auth.models import User as AuthUser
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import Account, User
from api.serializers import LoginSerializer, RegisterSerializer


@extend_schema(summary="Регистрация", tags=["Auth"])
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'status': 'error', 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = serializer.validated_data['username']
    password = serializer.validated_data['password']

    auth_user = AuthUser.objects.create_user(username=username, password=password)
    api_user = User.objects.create(
        internal_id=f'user_{auth_user.id}',
        auth_user=auth_user,
        is_smartdebit_enabled=False,
    )
    Account.objects.create(user=api_user, balance=0, currency='RUB')

    refresh = RefreshToken.for_user(auth_user)
    return Response(
        {
            'status': 'success',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(summary="Вход", tags=["Auth"])
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'status': 'error', 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = serializer.validated_data['username']
    password = serializer.validated_data['password']

    auth_user = authenticate(username=username, password=password)
    if not auth_user:
        return Response(
            {'status': 'error', 'message': 'Неверный логин или пароль'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(auth_user)
    return Response({
        'status': 'success',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@extend_schema(summary="Обновление access token", tags=["Auth"])
@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh_view(request):
    serializer = TokenRefreshSerializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
    except (InvalidToken, TokenError):
        return Response(
            {
                'status': 'error',
                'message': 'Сессия истекла. Войдите снова.',
                'error_code': 'TOKEN_REFRESH_FAILED',
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )
    except Exception:
        return Response(
            {
                'status': 'error',
                'message': 'Не удалось обновить сессию. Войдите снова.',
                'error_code': 'TOKEN_REFRESH_ERROR',
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return Response(serializer.validated_data)

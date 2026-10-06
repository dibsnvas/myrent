from rest_framework_simplejwt.views import TokenRefreshView

from django.urls import path

from apps.auths.views import ChangePasswordView, LoginView, MeView, RegisterView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('password/', ChangePasswordView.as_view(), name='change-password'),
]

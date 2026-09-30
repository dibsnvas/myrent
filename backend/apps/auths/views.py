from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.auths.models import User
from apps.auths.serializers import DeleteAccountSerializer, LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """Create a tenant account and log straight in."""

    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = 'auth'


class MeView(generics.RetrieveUpdateDestroyAPIView):
    """The logged-in user's profile. DELETE removes the account and every record in it."""

    serializer_class = UserSerializer
    http_method_names = ('get', 'patch', 'delete', 'head', 'options')

    def get_object(self) -> User:
        return self.request.user

    @extend_schema(request=DeleteAccountSerializer, responses={204: None})
    def delete(self, request: Request, *args, **kwargs) -> Response:
        serializer = DeleteAccountSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        # Properties cascade to contracts, payments, readings and documents; the document
        # post_delete signal removes the stored files too.
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

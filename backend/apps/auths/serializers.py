from __future__ import annotations

from typing import Any

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from apps.auths.constants import NAME_MAX_LENGTH
from apps.auths.models import User


def tokens_for(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'consent_given_at', 'date_joined')
        read_only_fields = ('id', 'email', 'consent_given_at', 'date_joined')


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    first_name = serializers.CharField(max_length=NAME_MAX_LENGTH)
    last_name = serializers.CharField(max_length=NAME_MAX_LENGTH, required=False, allow_blank=True)
    consent = serializers.BooleanField(
        help_text='The user accepted how MyRent stores their data. Must be true.',
    )

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError('Please accept the data terms to create an account.')
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        candidate = User(email=attrs['email'], first_name=attrs['first_name'], last_name=attrs.get('last_name', ''))
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data: dict[str, Any]) -> User:
        validated_data.pop('consent')
        return User.objects.create_user(consent_given_at=timezone.now(), **validated_data)

    def to_representation(self, instance: User) -> dict[str, Any]:
        return {'user': UserSerializer(instance).data, **tokens_for(instance)}


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password -> access/refresh tokens and the user profile."""

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs[self.username_field] = attrs[self.username_field].strip().lower()
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate_password(self, value: str) -> str:
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Wrong password.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate_current_password(self, value: str) -> str:
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Wrong password.')
        return value

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password(value, user=self.context['request'].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

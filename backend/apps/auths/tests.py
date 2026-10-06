from rest_framework import status
from rest_framework.test import APITestCase

from django.core.cache import cache
from django.urls import reverse

from apps.auths.models import User

STRONG_PASSWORD = 'correct-horse-battery-42'


class AuthTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()  # login throttling counts requests in the cache

    def register(self, **overrides) -> 'object':
        payload = {
            'email': 'Aru@Example.com',
            'password': STRONG_PASSWORD,
            'first_name': 'Aru',
            'consent': True,
        } | overrides
        return self.client.post(reverse('register'), payload, format='json')

    def test_register_returns_tokens_and_records_consent(self) -> None:
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['email'], 'aru@example.com')
        self.assertIsNotNone(User.objects.get().consent_given_at)

    def test_register_requires_consent(self) -> None:
        response = self.register(consent=False)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('consent', response.data)
        self.assertFalse(User.objects.exists())

    def test_register_rejects_weak_password_and_duplicate_email(self) -> None:
        self.assertIn('password', self.register(password='12345678').data)
        self.register()
        self.assertIn('email', self.register(email='aru@example.com').data)

    def test_login_is_case_insensitive_and_me_works(self) -> None:
        self.register()
        response = self.client.post(
            reverse('login'), {'email': 'ARU@example.com', 'password': STRONG_PASSWORD}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        me = self.client.get(reverse('me'))
        self.assertEqual(me.data['first_name'], 'Aru')

    def test_me_requires_login(self) -> None:
        self.assertEqual(self.client.get(reverse('me')).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_account_needs_password(self) -> None:
        access = self.register().data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        wrong = self.client.delete(reverse('me'), {'password': 'nope'}, format='json')
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        right = self.client.delete(reverse('me'), {'password': STRONG_PASSWORD}, format='json')
        self.assertEqual(right.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.exists())

    def test_change_password(self) -> None:
        access = self.register().data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        wrong = self.client.post(reverse('change-password'), {
            'current_password': 'nope', 'new_password': 'another-good-pass-77',
        }, format='json')
        self.assertIn('current_password', wrong.data)
        weak = self.client.post(reverse('change-password'), {
            'current_password': STRONG_PASSWORD, 'new_password': '123',
        }, format='json')
        self.assertIn('new_password', weak.data)
        ok = self.client.post(reverse('change-password'), {
            'current_password': STRONG_PASSWORD, 'new_password': 'another-good-pass-77',
        }, format='json')
        self.assertEqual(ok.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(User.objects.get().check_password('another-good-pass-77'))

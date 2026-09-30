from django.apps import AppConfig


class RentalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rentals'

    def ready(self) -> None:
        from apps.rentals import signals  # noqa: F401

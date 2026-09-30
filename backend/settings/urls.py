"""Root URL configuration."""
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from django.contrib import admin
from django.http import HttpRequest, JsonResponse
from django.urls import include, path


def health(request: HttpRequest) -> JsonResponse:
    """Render's health check and the cron's wake-up call."""
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health, name='health'),
    path('api/auth/', include('apps.auths.urls')),
    path('api/', include('apps.rentals.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

"""Django storage that keeps file bytes in the StoredFile table.

Used on the free Render setup, where the disk is wiped on every deploy and no bucket is configured.
Files are only ever served through the signed /api/files/ links, so there is no public URL.
"""
from __future__ import annotations

from django.core.files.base import ContentFile, File
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    @staticmethod
    def _model():
        from apps.rentals.models import StoredFile  # storage is loaded before the app registry is ready

        return StoredFile

    def _open(self, name: str, mode: str = 'rb') -> File:
        stored = self._model().objects.get(name=name)
        return ContentFile(bytes(stored.content), name=name)

    def _save(self, name: str, content: File) -> str:
        content.seek(0)
        data = content.read()
        self._model().objects.create(name=name, content=data, size=len(data))
        return name

    def delete(self, name: str) -> None:
        self._model().objects.filter(name=name).delete()

    def exists(self, name: str) -> bool:
        return self._model().objects.filter(name=name).exists()

    def size(self, name: str) -> int:
        return self._model().objects.values_list('size', flat=True).get(name=name)

    def url(self, name: str) -> str:
        return ''  # no public URL on purpose; use the signed link from the API

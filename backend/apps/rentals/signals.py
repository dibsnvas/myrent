from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.rentals.models import Document


@receiver(post_delete, sender=Document)
def delete_stored_file(sender: type[Document], instance: Document, **kwargs) -> None:
    """Remove the file from storage when its row goes, including cascades from Property and User."""
    if instance.file:
        instance.file.delete(save=False)

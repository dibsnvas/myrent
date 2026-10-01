from django.db import migrations


class Migration(migrations.Migration):
    """Rollback of the landlord mode: contact_* back to landlord_*."""

    dependencies = [
        ('rentals', '0003_contact_fields'),
    ]

    operations = [
        migrations.RenameField(model_name='property', old_name='contact_name', new_name='landlord_name'),
        migrations.RenameField(model_name='property', old_name='contact_phone', new_name='landlord_phone'),
        migrations.RenameField(model_name='property', old_name='contact_email', new_name='landlord_email'),
    ]

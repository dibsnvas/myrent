from django.db import migrations


class Migration(migrations.Migration):
    """landlord_* -> contact_*: the same fields hold the tenant's contacts for a landlord."""

    dependencies = [
        ('rentals', '0002_stored_file'),
    ]

    operations = [
        migrations.RenameField(model_name='property', old_name='landlord_name', new_name='contact_name'),
        migrations.RenameField(model_name='property', old_name='landlord_phone', new_name='contact_phone'),
        migrations.RenameField(model_name='property', old_name='landlord_email', new_name='contact_email'),
    ]

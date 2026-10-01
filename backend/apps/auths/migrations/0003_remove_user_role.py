from django.db import migrations


class Migration(migrations.Migration):
    """Rollback of the landlord mode: users no longer have a role."""

    dependencies = [
        ('auths', '0002_user_role'),
    ]

    operations = [
        migrations.RemoveField(model_name='user', name='role'),
    ]

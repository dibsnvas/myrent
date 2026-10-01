from django.db import migrations, models


def existing_users_are_tenants(apps, schema_editor):
    """Everyone who signed up before roles existed used MyRent as a tenant."""
    apps.get_model('auths', 'User').objects.filter(role__isnull=True).update(role='tenant')


class Migration(migrations.Migration):

    dependencies = [
        ('auths', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.CharField(
                blank=True,
                choices=[('tenant', 'I rent a home'), ('landlord', 'I rent out a home')],
                help_text='Chosen on the onboarding screen right after sign-up; empty until then.',
                max_length=20,
                null=True,
            ),
        ),
        migrations.RunPython(existing_users_are_tenants, migrations.RunPython.noop),
    ]

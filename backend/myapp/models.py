from django.db import models

# Create your models here.
class File(models.Model):
    class Meta:
        managed = False

    file = models.FileField(upload_to='files')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    parsed = models.DateTimeField(blank=False, default=False)
    parsed_error = models.TextField(blank=True, default=False)

class Reading(models.Model):
    class Meta:
        managed = False

    file = models.ForeignKey(File, on_delete=models.RESTRICT)
    timestamp = models.DateTimeField(blank=False, null=False, primary_key=True)
    myapp_name = models.TextField(blank=False, null=False)
    reading = models.TextField(blank=False, null=False)



from django.urls import path
from . import views


app_name = 'myapp'

urlpatterns = [
    path("", views.index, name="root"),
    path('upload/', views.upload_file, name='upload_file'),
]

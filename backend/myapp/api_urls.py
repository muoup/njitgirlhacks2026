#api imports
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from django.urls import path

app_name = 'myapp'

@api_view(['GET'])
def api_root(request, format = 'None'):
    return Response({
        'myapps': reverse('api:myapps:api-root', request=request, format=format),
    })

urlpatterns = [
    path('', api_root, name="api-root"),

]
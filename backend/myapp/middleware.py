from .models import RequestLog

class RequestLogMiddleware(object):
    def __init__(self, get_response):
        self.get_response = get_response


    def __call__(self, request):
        response = self.get_response(request)
        RequestLog.objects.create(
            method=request.method,
            path=request.method,
            status_code=response.status_code,
            ip=request.META['REMOTE_ADDR'],
        )
        return response
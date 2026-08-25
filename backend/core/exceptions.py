from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Custom exception handler for consistent error responses."""
    response = exception_handler(exc, context)

    if response is not None:
        return response

    # Handle unexpected errors
    return Response(
        {
            'detail': 'An internal server error occurred.',
            'code': 'internal_error',
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

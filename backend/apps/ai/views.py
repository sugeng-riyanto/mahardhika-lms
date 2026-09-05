from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .services import MelanyAIService


class MelanyChatView(APIView):
    """
    Endpoint untuk chat dengan Melany AI.
    POST /api/v1/ai/melany-chat/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        activity_id = request.data.get('activity_id')
        context_type = request.data.get('context_type', 'chat')
        user_message = request.data.get('message')
        canvas_data = request.data.get('canvas_data', None)
        
        if not activity_id or not user_message:
            return Response(
                {"error": "activity_id dan message wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if context_type not in ['chat', 'canvas', 'essay']:
            return Response(
                {"error": "context_type harus 'chat', 'canvas', atau 'essay'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = MelanyAIService()
        
        try:
            # Note: generate_response is async, but DRF sync views use sync_to_async
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            ai_response = loop.run_until_complete(
                service.generate_response(
                    user=request.user,
                    activity_id=activity_id,
                    context_type=context_type,
                    user_message=user_message,
                    canvas_data=canvas_data
                )
            )
            
            return Response({
                "success": True,
                "response": ai_response,
                "context_type": context_type
            })
            
        except PermissionDenied as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {"error": f"Terjadi kesalahan internal: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MelanyHealthCheckView(APIView):
    """
    Endpoint untuk cek kesehatan layanan AI.
    GET /api/v1/ai/health/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        service = MelanyAIService()
        return Response({
            "status": "ok",
            "api_url": service.api_url,
            "model": service.model,
            "system_prompt_loaded": len(service.system_prompt) > 0
        })

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
        context_type = request.data.get('context_type', 'chat')
        user_message = request.data.get('message')
        context_data = request.data.get('context_data', None)
        
        if not user_message:
            return Response(
                {"error": "message wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if context_type not in ['chat', 'camp', 'pathway', 'certificate', 'registration']:
            return Response(
                {"error": "context_type harus 'chat', 'camp', 'pathway', 'certificate', atau 'registration'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = MelanyAIService()
        
        try:
            ai_response = service.generate_response(
                user=request.user,
                context_type=context_type,
                user_message=user_message,
                context_data=context_data
            )
            
            return Response({
                "success": True,
                "response": ai_response,
                "context_type": context_type
            })
            
        except Exception as e:
            return Response(
                {"error": f"Terjadi kesalahan: {str(e)}"},
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
            "mode": "local_knowledge_base",
            "system_prompt_loaded": len(service.system_prompt) > 0,
            "programs_loaded": len(service.programs.get('camps', [])) > 0
        })


class ProgramsListView(APIView):
    """
    Endpoint untuk mendapatkan daftar program Dharma Mardika.
    GET /api/v1/ai/programs/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        service = MelanyAIService()
        return Response({
            "camps": service.programs['camps'],
            "pathways": service.programs['pathways'],
            "platforms": service.programs['platforms']
        })

import httpx
import os
from django.conf import settings
from django.core.exceptions import PermissionDenied


class MelanyAIService:
    """
    Service untuk berinteraksi dengan Melany AI via DeepSeek API.
    """
    
    def __init__(self):
        self.api_url = getattr(
            settings, 
            'MELANY_API_URL', 
            os.getenv('MELANY_API_URL', 'https://api.deepseek.com/v1/chat/completions')
        )
        self.model = getattr(
            settings, 
            'MELANY_MODEL', 
            os.getenv('MELANY_MODEL', 'deepseek-chat')
        )
        self.api_key = getattr(
            settings,
            'DEEPSEEK_API_KEY',
            os.getenv('DEEPSEEK_API_KEY', '')
        )
        self.system_prompt = self._load_system_prompt()
    
    def _load_system_prompt(self):
        """Load system prompt dari file config."""
        prompt_path = os.path.join(
            settings.BASE_DIR, 
            'config', 
            'melany_system_prompt.txt'
        )
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return "Anda adalah Melany AI, asisten pembelajaran STEAM untuk Mahardhika LMS."
    
    def _check_access(self, user, activity_id):
        """Validasi RBAC - pastikan user memiliki akses ke aktivitas."""
        # Student: can access own activities
        # Instructor: can access activities they teach
        # Admin/Owner: can access all
        if hasattr(user, 'role'):
            if user.role in ('admin', 'owner'):
                return True
        return True  # Default allow for now; strict RBAC checked in views
    
    async def generate_response(
        self, 
        user, 
        activity_id, 
        context_type, 
        user_message, 
        canvas_data=None
    ):
        """Generate respons AI untuk siswa."""
        
        if not self._check_access(user, activity_id):
            raise PermissionDenied("Anda tidak memiliki akses ke aktivitas ini.")
        
        # Build dynamic context for the LLM
        user_role = 'student'
        grade_level = 'unknown'
        if hasattr(user, 'roleassignment_set'):
            ra = user.roleassignment_set.first()
            if ra and ra.role:
                user_role = ra.role.name
        if hasattr(user, 'profile'):
            grade_level = getattr(user.profile, 'grade_level', 'unknown')
        
        dynamic_context = f"""
[USER CONTEXT]
- Role: {user_role}
- Grade Level: {grade_level}
- Current Activity ID: {activity_id}
- Context Type: {context_type}

[CANVAS DATA]
{canvas_data if canvas_data else "Tidak ada data canvas."}
"""
        
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": f"{dynamic_context}\n\nPertanyaan Siswa: {user_message}"}
        ]
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.api_url,
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 800,
                        "stream": False
                    },
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except httpx.ConnectError:
            return "⚠️ Maaf, layanan AI sedang tidak tersedia. Pastikan LM Studio berjalan di komputer Anda."
        except httpx.TimeoutException:
            return "⏱️ Respons AI memakan waktu terlalu lama. Coba pertanyaannya lebih singkat."
        except Exception as e:
            return f"❌ Terjadi kesalahan: {str(e)}"

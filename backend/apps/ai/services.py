"""
Melany AI Service - Dharma Mardika Ecosystem Navigator

This service provides context-aware responses based on the LMS ecosystem.
No external API required - uses built-in knowledge base for program navigation.
"""

import os
from django.conf import settings


class MelanyAIService:
    """
    Service untuk Melany AI - navigasi ekosistem Dharma Mardika.
    Menggunakan knowledge base lokal tanpa API eksternal.
    """
    
    def __init__(self):
        self.system_prompt = self._load_system_prompt()
        self.programs = self._load_programs()
    
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
            return "Anda adalah Melany AI, asisten Dharma Mardika."
    
    def _load_programs(self):
        """Knowledge base program Dharma Mardika."""
        return {
            'camps': [
                {
                    'name': 'STEM Camp',
                    'period': 'Juni-Juli 2027',
                    'topics': ['Arduino', 'IoT', 'Robotics', 'Data Science'],
                    'target': 'JHS Grade 5-8, HS Grade 9-12'
                },
                {
                    'name': 'Arts Camp',
                    'period': 'Juni-Juli 2027',
                    'topics': ['Visual Arts', 'Music Production', 'Creative Writing'],
                    'target': 'All grade levels'
                },
                {
                    'name': 'Explorers Camp',
                    'period': 'Juni-Juli 2027',
                    'topics': ['Outdoor Education', 'Leadership', 'Environmental Science'],
                    'target': 'JHS students'
                },
                {
                    'name': 'Life Skills Camp',
                    'period': 'Juni-Juli 2027',
                    'topics': ['Financial Literacy', 'HYROX Fitness', 'Public Speaking'],
                    'target': 'HS students'
                }
            ],
            'pathways': {
                'local': ['PTN (SNBT/UTBK)', 'PTS', 'TKA', 'UN Preparation'],
                'international': {
                    'US/Canada': ['ASPECTAMA', '@america'],
                    'UK': ['British Council', 'TBI'],
                    'China': ['CSCA', 'HSK'],
                    'Counsellors': ['JACK', 'IDP']
                }
            },
            'platforms': ['Coursera', 'Alison', 'edX']
        }
    
    def generate_response(self, user, context_type, user_message, context_data=None):
        """
        Generate respons berdasarkan knowledge base.
        Tidak memerlukan API eksternal.
        """
        user_message_lower = user_message.lower()
        
        # Detect intent
        if any(word in user_message_lower for word in ['camp', 'STEM', 'robotics', 'arduino']):
            return self._camp_response(user_message_lower)
        elif any(word in user_message_lower for word in ['universitas', 'kuliah', 'PTN', 'SNBT', 'UTBK']):
            return self._pathway_response('local', user_message_lower)
        elif any(word in user_message_lower for word in ['international', 'UK', 'US', 'China', 'inggris', 'amerika']):
            return self._pathway_response('international', user_message_lower)
        elif any(word in user_message_lower for word in ['course', 'materi', 'belajar', 'content']):
            return self._materials_response(user_message_lower)
        elif any(word in user_message_lower for word in ['certificate', 'sertifikat', 'ijazah']):
            return self._certificate_response(user_message_lower)
        elif any(word in user_message_lower for word in ['daftar', 'register', 'pendaftaran', 'enroll']):
            return self._registration_response(user_message_lower)
        elif any(word in user_message_lower for word in ['halo', 'hai', 'hello', 'hi']):
            return self._greeting_response(user)
        else:
            return self._general_response(user_message_lower)
    
    def _camp_response(self, message):
        """Response untuk pertanyaan tentang camps."""
        camps = self.programs['camps']
        response = "Dharma Mardika menyelenggarakan 4 program Camp di Juni-Juli 2027:\n\n"
        for camp in camps:
            response += f"**{camp['name']}**\n"
            response += f"  - Topik: {', '.join(camp['topics'])}\n"
            response += f"  - Target: {camp['target']}\n\n"
        response += "Untuk mendaftar, silakan kunjungi halaman Registration di LMS atau hubungi admin."
        return response
    
    def _pathway_response(self, pathway_type, message):
        """Response untuk university pathways."""
        if pathway_type == 'local':
            paths = self.programs['pathways']['local']
            response = "Untuk persiapan universitas lokal, kami menyediakan:\n\n"
            for p in paths:
                response += f"- {p}\n"
            response += "\nSilakan pilih program yang sesuai dengan kebutuhan Anda."
        else:
            intl = self.programs['pathways']['international']
            response = "Program internasional yang tersedia:\n\n"
            for country, partners in intl.items():
                response += f"**{country}**:\n"
                for partner in partners:
                    response += f"  - {partner}\n"
            response += "\nHubungi konselor untuk informasi lebih lanjut."
        return response
    
    def _materials_response(self, message):
        """Response untuk materials/course."""
        return ("Anda dapat mengakses materi pembelajaran melalui:\n\n"
                "1. **Content Library** - PDF, video, slides, audio\n"
                "2. **Courses** - Materi terstruktur per mata pelajaran\n"
                "3. **Assignments** - Tugas dan praktik\n"
                "4. **Essays** - Asesmen tulis\n\n"
                "Gunakan menu Courses atau Content Library di sidebar untuk mulai belajar.")
    
    def _certificate_response(self, message):
        """Response untuk certificates."""
        return ("Sertifikat Dharma Mardika memiliki fitur:\n\n"
                "1. **Blockchain Verification** - Setiap sertifikat memiliki hash unik\n"
                "2. **QR Code** - Scan untuk verifikasi keaslian\n"
                "3. **Online Verification** - Cek di /verify-certificate/[code]\n\n"
                "Sertifikat akan diterbitkan setelah menyelesaikan program dengan nilai yang memenuhi standar.")
    
    def _registration_response(self, message):
        """Response untuk pendaftaran."""
        return ("Untuk mendaftar program Dharma Mardika:\n\n"
                "1. Login ke LMS dengan akun Anda\n"
                "2. Pilih menu **Courses** atau **Programmes**\n"
                "3. Klik **Enroll** pada program yang diminati\n"
                "4. Ikuti instruksi pembayaran jika diperlukan\n"
                "5. Konfirmasi akan dikirim via email/notifikasi\n\n"
                "Untuk Camp 2027, pendaftaran dibuka Maret 2027.")
    
    def _greeting_response(self, user):
        """Response greeting."""
        name = getattr(user, 'full_name', None) or getattr(user, 'email', 'Siswa').split('@')[0]
        return (f"Halo {name}! 👋\n\n"
                "Saya Melany AI, asisten Anda di Dharma Mardika LMS.\n\n"
                "Saya bisa membantu Anda dengan:\n"
                "- Informasi program Camp (STEM, Arts, Explorers, Life Skills)\n"
                "- Persiapan universitas (lokal & internasional)\n"
                "- Akses materi dan courses\n"
                "- Informasi sertifikat\n\n"
                "Ada yang bisa saya bantu?")
    
    def _general_response(self, message):
        """Response general."""
        return ("Terima kasih atas pertanyaan Anda.\n\n"
                "Saya bisa membantu Anda menavigasi ekosistem Dharma Mardika, termasuk:\n"
                "- Program Camp dan University Pathways\n"
                "- Materi pembelajaran di LMS\n"
                "- Informasi sertifikat\n"
                "- Pendaftaran program\n\n"
                "Silakan tanyakan topik spesifik, atau kunjungi halaman terkait di LMS.")

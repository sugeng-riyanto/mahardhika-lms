-- =====================================================
-- AI FEATURES FOR MAHARDHIKA LMS
-- Created: 2026-09-05
-- Compatible with existing 8-role RBAC system
-- =====================================================

-- 1. Tabel untuk menyimpan riwayat percakapan AI
CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    context_type VARCHAR(50) CHECK (context_type IN ('chat', 'camp', 'pathway', 'certificate', 'registration')),
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user ON public.ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_context ON public.ai_interactions(context_type);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

-- User hanya bisa melihat interaksi mereka sendiri
CREATE POLICY "Users can view own AI interactions" 
ON public.ai_interactions
FOR SELECT 
USING (auth.uid() = user_id);

-- User bisa insert interaksi mereka sendiri
CREATE POLICY "Users can insert own AI interactions" 
ON public.ai_interactions
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admin bisa melihat semua interaksi
CREATE POLICY "Admins can view all AI interactions" 
ON public.ai_interactions
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

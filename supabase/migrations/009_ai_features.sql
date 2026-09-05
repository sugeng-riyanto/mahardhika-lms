-- =====================================================
-- AI FEATURES FOR MAHARDHIKA LMS
-- Created: 2026-09-05
-- Compatible with existing 8-role RBAC system
-- =====================================================

-- 1. Tabel untuk menyimpan riwayat percakapan AI per aktivitas
CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES public.activity_definitions(id) ON DELETE CASCADE,
    context_type VARCHAR(50) CHECK (context_type IN ('chat', 'canvas', 'essay')),
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel khusus untuk feedback AI di Annotation Canvas
CREATE TABLE IF NOT EXISTS public.ai_canvas_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    interaction_id UUID REFERENCES public.ai_interactions(id) ON DELETE CASCADE,
    layer_index INT,
    coordinate_x FLOAT,
    coordinate_y FLOAT,
    feedback_text TEXT NOT NULL,
    is_accepted_by_instructor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_ai_interactions_student ON public.ai_interactions(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_activity ON public.ai_interactions(activity_id);
CREATE INDEX IF NOT EXISTS idx_ai_canvas_feedback_interaction ON public.ai_canvas_feedback(interaction_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_canvas_feedback ENABLE ROW LEVEL SECURITY;

-- Siswa hanya bisa melihat interaksi mereka sendiri
CREATE POLICY "Students can view own AI interactions" 
ON public.ai_interactions
FOR SELECT 
USING (auth.uid() = student_id);

-- Siswa bisa insert interaksi mereka sendiri
CREATE POLICY "Students can insert own AI interactions" 
ON public.ai_interactions
FOR INSERT 
WITH CHECK (auth.uid() = student_id);

-- Instructor bisa melihat interaksi siswa di aktivitas yang mereka ajar
CREATE POLICY "Instructors can view AI interactions for their activities" 
ON public.ai_interactions
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.instructor_activities 
        WHERE instructor_id = auth.uid() 
        AND activity_id = ai_interactions.activity_id
    )
);

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

-- Feedback canvas: siswa bisa insert
CREATE POLICY "Students can insert canvas feedback" 
ON public.ai_canvas_feedback
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.ai_interactions 
        WHERE id = ai_canvas_feedback.interaction_id 
        AND student_id = auth.uid()
    )
);

-- Feedback canvas: instructor bisa view & update (untuk approval)
CREATE POLICY "Instructors can view canvas feedback" 
ON public.ai_canvas_feedback
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.ai_interactions ai
        JOIN public.instructor_activities ia ON ia.activity_id = ai.activity_id
        WHERE ai.id = ai_canvas_feedback.interaction_id 
        AND ia.instructor_id = auth.uid()
    )
);

CREATE POLICY "Instructors can update canvas feedback" 
ON public.ai_canvas_feedback
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.ai_interactions ai
        JOIN public.instructor_activities ia ON ia.activity_id = ai.activity_id
        WHERE ai.id = ai_canvas_feedback.interaction_id 
        AND ia.instructor_id = auth.uid()
    )
);

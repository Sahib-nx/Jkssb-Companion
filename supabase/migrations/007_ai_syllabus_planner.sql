-- ==============================================================================
-- MTS COMPANION — MIGRATION 007: AI-POWERED SYLLABUS PLANNER SCHEMA
-- ==============================================================================

-- 1. AI SYLLABUS ROADMAPS TABLE
CREATE TABLE IF NOT EXISTS public.ai_syllabus_roadmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_study_hours NUMERIC(4, 2) NOT NULL DEFAULT 2.0,
    target_date DATE,
    unavailable_days TEXT[] NOT NULL DEFAULT '{}'::text[],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    overview JSONB NOT NULL DEFAULT '{}'::jsonb,
    subject_roadmaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    weekly_milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    weekly_review JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. PERFORMANCE INDEXES FOR ROADMAPS
CREATE INDEX IF NOT EXISTS idx_ai_roadmaps_user_status ON public.ai_syllabus_roadmaps(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_roadmaps_created_at ON public.ai_syllabus_roadmaps(created_at DESC);

-- 3. TRIGGER FOR ROADMAPS updated_at
DROP TRIGGER IF EXISTS set_ai_syllabus_roadmaps_updated_at ON public.ai_syllabus_roadmaps;
CREATE TRIGGER set_ai_syllabus_roadmaps_updated_at
    BEFORE UPDATE ON public.ai_syllabus_roadmaps
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. RLS FOR ai_syllabus_roadmaps
ALTER TABLE public.ai_syllabus_roadmaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI roadmaps" ON public.ai_syllabus_roadmaps;
CREATE POLICY "Users can view own AI roadmaps"
    ON public.ai_syllabus_roadmaps FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own AI roadmaps" ON public.ai_syllabus_roadmaps;
CREATE POLICY "Users can insert own AI roadmaps"
    ON public.ai_syllabus_roadmaps FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own AI roadmaps" ON public.ai_syllabus_roadmaps;
CREATE POLICY "Users can update own AI roadmaps"
    ON public.ai_syllabus_roadmaps FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own AI roadmaps" ON public.ai_syllabus_roadmaps;
CREATE POLICY "Users can delete own AI roadmaps"
    ON public.ai_syllabus_roadmaps FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 5. EXTEND study_tasks TO SEAMLESSLY INTEGRATE AI ROADMAP TASKS
ALTER TABLE public.study_tasks
    ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'custom',
    ADD COLUMN IF NOT EXISTS lecture_id UUID REFERENCES public.lectures(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS roadmap_id UUID REFERENCES public.ai_syllabus_roadmaps(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 30;

-- Update status check constraint to support 'partially_completed' and 'skipped'
ALTER TABLE public.study_tasks DROP CONSTRAINT IF EXISTS study_tasks_status_check;
ALTER TABLE public.study_tasks
    ADD CONSTRAINT study_tasks_status_check
    CHECK (status IN ('pending', 'completed', 'partially_completed', 'skipped'));

-- Add check constraint on task_type
ALTER TABLE public.study_tasks DROP CONSTRAINT IF EXISTS study_tasks_task_type_check;
ALTER TABLE public.study_tasks
    ADD CONSTRAINT study_tasks_task_type_check
    CHECK (task_type IN ('lecture', 'practice', 'revision', 'recall', 'catchup', 'custom'));

-- Add check constraint on priority
ALTER TABLE public.study_tasks DROP CONSTRAINT IF EXISTS study_tasks_priority_check;
ALTER TABLE public.study_tasks
    ADD CONSTRAINT study_tasks_priority_check
    CHECK (priority IN ('high', 'medium', 'low'));

-- Indexes for AI tasks
CREATE INDEX IF NOT EXISTS idx_study_tasks_roadmap ON public.study_tasks(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_lecture ON public.study_tasks(lecture_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_ai ON public.study_tasks(user_id, is_ai_generated);

-- Grant privileges
GRANT ALL ON public.ai_syllabus_roadmaps TO authenticated;
GRANT ALL ON public.ai_syllabus_roadmaps TO service_role;

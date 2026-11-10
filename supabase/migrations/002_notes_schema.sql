-- ==============================================================================
-- MTS COMPANION — PHASE 2: NOTES SCHEMA (LECTURE NOTES & GENERAL NOTES)
-- ==============================================================================

-- 1. LECTURE NOTES TABLE
CREATE TABLE IF NOT EXISTS public.lecture_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    plain_text TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_lecture_notes UNIQUE (user_id, lecture_id)
);

-- 2. GENERAL NOTES TABLE
CREATE TABLE IF NOT EXISTS public.general_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Note',
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    plain_text TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_lecture_notes_user_lecture ON public.lecture_notes(user_id, lecture_id);
CREATE INDEX IF NOT EXISTS idx_lecture_notes_user_id ON public.lecture_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_notes_lecture_id ON public.lecture_notes(lecture_id);

CREATE INDEX IF NOT EXISTS idx_general_notes_user_id ON public.general_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_general_notes_subject_id ON public.general_notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_general_notes_updated_at ON public.general_notes(updated_at DESC);

-- 4. TRIGGERS FOR updated_at
DROP TRIGGER IF EXISTS set_lecture_notes_updated_at ON public.lecture_notes;
CREATE TRIGGER set_lecture_notes_updated_at
    BEFORE UPDATE ON public.lecture_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_general_notes_updated_at ON public.general_notes;
CREATE TRIGGER set_general_notes_updated_at
    BEFORE UPDATE ON public.general_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.lecture_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_notes ENABLE ROW LEVEL SECURITY;

-- Lecture Notes Policies: Strict user isolation
DROP POLICY IF EXISTS "Users can view own lecture notes" ON public.lecture_notes;
CREATE POLICY "Users can view own lecture notes"
    ON public.lecture_notes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lecture notes" ON public.lecture_notes;
CREATE POLICY "Users can insert own lecture notes"
    ON public.lecture_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lecture notes" ON public.lecture_notes;
CREATE POLICY "Users can update own lecture notes"
    ON public.lecture_notes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lecture notes" ON public.lecture_notes;
CREATE POLICY "Users can delete own lecture notes"
    ON public.lecture_notes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- General Notes Policies: Strict user isolation
DROP POLICY IF EXISTS "Users can view own general notes" ON public.general_notes;
CREATE POLICY "Users can view own general notes"
    ON public.general_notes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own general notes" ON public.general_notes;
CREATE POLICY "Users can insert own general notes"
    ON public.general_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own general notes" ON public.general_notes;
CREATE POLICY "Users can update own general notes"
    ON public.general_notes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own general notes" ON public.general_notes;
CREATE POLICY "Users can delete own general notes"
    ON public.general_notes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

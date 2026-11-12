-- ==============================================================================
-- MTS COMPANION — PHASE 5: DYNAMIC USER WORKSPACES & MULTI-USER ISOLATION
-- ==============================================================================

-- 1. ADD USER_ID & ARCHIVE FLAGS TO SUBJECTS
ALTER TABLE public.subjects 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6',
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Drop global unique constraint on slug so different users can have subjects with the same slug/name
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_slug_key;

-- Add per-user unique constraint on (user_id, slug) for active subjects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_subject_slug'
    ) THEN
        ALTER TABLE public.subjects 
            ADD CONSTRAINT uq_user_subject_slug UNIQUE (user_id, slug);
    END IF;
END $$;

-- 2. ADD USER_ID & ARCHIVE FLAGS TO LECTURES
ALTER TABLE public.lectures
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 3. MIGRATE EXISTING OWNER DATA SAFELY
-- Find the existing owner from lecture_progress, lecture_notes, revision_sessions, study_tasks, or auth.users
DO $$
DECLARE
    existing_owner_id UUID;
BEGIN
    SELECT user_id INTO existing_owner_id FROM public.lecture_progress WHERE user_id IS NOT NULL LIMIT 1;
    
    IF existing_owner_id IS NULL THEN
        SELECT user_id INTO existing_owner_id FROM public.lecture_notes WHERE user_id IS NOT NULL LIMIT 1;
    END IF;
    
    IF existing_owner_id IS NULL THEN
        SELECT user_id INTO existing_owner_id FROM public.revision_sessions WHERE user_id IS NOT NULL LIMIT 1;
    END IF;
    
    IF existing_owner_id IS NULL THEN
        SELECT user_id INTO existing_owner_id FROM public.study_tasks WHERE user_id IS NOT NULL LIMIT 1;
    END IF;

    IF existing_owner_id IS NULL THEN
        SELECT user_id INTO existing_owner_id FROM public.user_ai_preferences WHERE user_id IS NOT NULL LIMIT 1;
    END IF;

    IF existing_owner_id IS NULL THEN
        SELECT id INTO existing_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- If an existing user was found, assign all existing unassigned subjects and lectures to that owner
    IF existing_owner_id IS NOT NULL THEN
        UPDATE public.subjects 
        SET user_id = existing_owner_id 
        WHERE user_id IS NULL;

        UPDATE public.lectures 
        SET user_id = existing_owner_id 
        WHERE user_id IS NULL;
    END IF;
END $$;

-- Also ensure any lecture with a subject gets that subject's user_id if still null
UPDATE public.lectures l
SET user_id = s.user_id
FROM public.subjects s
WHERE l.subject_id = s.id AND l.user_id IS NULL AND s.user_id IS NOT NULL;

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_archived ON public.subjects(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_lectures_user_id ON public.lectures(user_id);
CREATE INDEX IF NOT EXISTS idx_lectures_subject_active ON public.lectures(subject_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_lectures_subject_number_active ON public.lectures(subject_id, lecture_number) WHERE is_archived = false;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

-- Subjects RLS: Strict user isolation
DROP POLICY IF EXISTS "Allow authenticated read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can view own subjects" ON public.subjects;
CREATE POLICY "Users can view own subjects"
    ON public.subjects
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subjects" ON public.subjects;
CREATE POLICY "Users can insert own subjects"
    ON public.subjects
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subjects" ON public.subjects;
CREATE POLICY "Users can update own subjects"
    ON public.subjects
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own subjects" ON public.subjects;
CREATE POLICY "Users can delete own subjects"
    ON public.subjects
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Lectures RLS: Strict user isolation
DROP POLICY IF EXISTS "Allow authenticated read lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can view own lectures" ON public.lectures;
CREATE POLICY "Users can view own lectures"
    ON public.lectures
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lectures" ON public.lectures;
CREATE POLICY "Users can insert own lectures"
    ON public.lectures
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lectures" ON public.lectures;
CREATE POLICY "Users can update own lectures"
    ON public.lectures
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lectures" ON public.lectures;
CREATE POLICY "Users can delete own lectures"
    ON public.lectures
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

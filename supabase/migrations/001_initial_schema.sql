-- ==============================================================================
-- MTS COMPANION — DATABASE SCHEMA & SEED MIGRATION (PHASE 1)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    total_lectures INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. LECTURES TABLE
CREATE TABLE IF NOT EXISTS public.lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    lecture_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_subject_lecture_number UNIQUE (subject_id, lecture_number)
);

-- 4. LECTURE PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.lecture_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_lecture UNIQUE (user_id, lecture_id)
);

-- 5. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_lectures_subject_id ON public.lectures(subject_id);
CREATE INDEX IF NOT EXISTS idx_lectures_subject_number ON public.lectures(subject_id, lecture_number);
CREATE INDEX IF NOT EXISTS idx_lecture_progress_user_id ON public.lecture_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_progress_lecture_id ON public.lecture_progress(lecture_id);
CREATE INDEX IF NOT EXISTS idx_lecture_progress_user_lecture ON public.lecture_progress(user_id, lecture_id);

-- 6. TRIGGER FOR updated_at ON lecture_progress
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lecture_progress_updated_at ON public.lecture_progress;
CREATE TRIGGER set_lecture_progress_updated_at
    BEFORE UPDATE ON public.lecture_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_progress ENABLE ROW LEVEL SECURITY;

-- Subjects policies: Authenticated users can read
DROP POLICY IF EXISTS "Allow authenticated read subjects" ON public.subjects;
CREATE POLICY "Allow authenticated read subjects"
    ON public.subjects
    FOR SELECT
    TO authenticated
    USING (true);

-- Lectures policies: Authenticated users can read
DROP POLICY IF EXISTS "Allow authenticated read lectures" ON public.lectures;
CREATE POLICY "Allow authenticated read lectures"
    ON public.lectures
    FOR SELECT
    TO authenticated
    USING (true);

-- Lecture progress policies: Users can only read and mutate their own records
DROP POLICY IF EXISTS "Users can view own progress" ON public.lecture_progress;
CREATE POLICY "Users can view own progress"
    ON public.lecture_progress
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON public.lecture_progress;
CREATE POLICY "Users can insert own progress"
    ON public.lecture_progress
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON public.lecture_progress;
CREATE POLICY "Users can update own progress"
    ON public.lecture_progress
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own progress" ON public.lecture_progress;
CREATE POLICY "Users can delete own progress"
    ON public.lecture_progress
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 8. SEED DATA (Idempotent: 4 Subjects & 255 Lectures)
DO $$
DECLARE
    sub_gk_id UUID;
    sub_eng_id UUID;
    sub_math_id UUID;
    sub_reas_id UUID;
    i INTEGER;
BEGIN
    -- Upsert Subjects
    INSERT INTO public.subjects (name, slug, total_lectures)
    VALUES ('General Knowledge', 'general-knowledge', 151)
    ON CONFLICT (slug) DO UPDATE SET total_lectures = 151
    RETURNING id INTO sub_gk_id;

    INSERT INTO public.subjects (name, slug, total_lectures)
    VALUES ('English', 'english', 54)
    ON CONFLICT (slug) DO UPDATE SET total_lectures = 54
    RETURNING id INTO sub_eng_id;

    INSERT INTO public.subjects (name, slug, total_lectures)
    VALUES ('Mathematics', 'mathematics', 29)
    ON CONFLICT (slug) DO UPDATE SET total_lectures = 29
    RETURNING id INTO sub_math_id;

    INSERT INTO public.subjects (name, slug, total_lectures)
    VALUES ('Reasoning', 'reasoning', 21)
    ON CONFLICT (slug) DO UPDATE SET total_lectures = 21
    RETURNING id INTO sub_reas_id;

    -- Seed 151 General Knowledge Lectures (Lecture 001 .. Lecture 151)
    FOR i IN 1..151 LOOP
        INSERT INTO public.lectures (subject_id, lecture_number, title)
        VALUES (sub_gk_id, i, 'Lecture ' || LPAD(i::text, 3, '0'))
        ON CONFLICT (subject_id, lecture_number) DO NOTHING;
    END LOOP;

    -- Seed 54 English Lectures (Lecture 001 .. Lecture 054)
    FOR i IN 1..54 LOOP
        INSERT INTO public.lectures (subject_id, lecture_number, title)
        VALUES (sub_eng_id, i, 'Lecture ' || LPAD(i::text, 3, '0'))
        ON CONFLICT (subject_id, lecture_number) DO NOTHING;
    END LOOP;

    -- Seed 29 Mathematics Lectures (Lecture 001 .. Lecture 029)
    FOR i IN 1..29 LOOP
        INSERT INTO public.lectures (subject_id, lecture_number, title)
        VALUES (sub_math_id, i, 'Lecture ' || LPAD(i::text, 3, '0'))
        ON CONFLICT (subject_id, lecture_number) DO NOTHING;
    END LOOP;

    -- Seed 21 Reasoning Lectures (Lecture 001 .. Lecture 021)
    FOR i IN 1..21 LOOP
        INSERT INTO public.lectures (subject_id, lecture_number, title)
        VALUES (sub_reas_id, i, 'Lecture ' || LPAD(i::text, 3, '0'))
        ON CONFLICT (subject_id, lecture_number) DO NOTHING;
    END LOOP;
END $$;

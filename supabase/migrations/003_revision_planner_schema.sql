-- ==============================================================================
-- MTS COMPANION — PHASE 3: REVISION CENTRE & DAILY PLANNER SCHEMA
-- ==============================================================================

-- 1. REVISION SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.revision_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    mode TEXT NOT NULL CHECK (mode IN ('single', 'range', 'entire_subject', 'custom')),
    scheduled_date DATE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. REVISION SESSION LECTURES TABLE
CREATE TABLE IF NOT EXISTS public.revision_session_lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_revised BOOLEAN NOT NULL DEFAULT false,
    is_difficult BOOLEAN NOT NULL DEFAULT false,
    needs_re_revision BOOLEAN NOT NULL DEFAULT false,
    revised_at TIMESTAMPTZ,
    CONSTRAINT uq_session_lecture UNIQUE (session_id, lecture_id)
);

-- 3. REVISION HISTORY TABLE (Historical log of all revisions)
CREATE TABLE IF NOT EXISTS public.revision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.revision_sessions(id) ON DELETE SET NULL,
    revised_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_difficult BOOLEAN NOT NULL DEFAULT false,
    needs_re_revision BOOLEAN NOT NULL DEFAULT false,
    next_revision_date DATE,
    notes TEXT
);

-- 4. STUDY TASKS TABLE (Daily Planner)
CREATE TABLE IF NOT EXISTS public.study_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_revision_sessions_user ON public.revision_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_status ON public.revision_sessions(status);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_scheduled_date ON public.revision_sessions(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_session_lectures_session ON public.revision_session_lectures(session_id);
CREATE INDEX IF NOT EXISTS idx_session_lectures_lecture ON public.revision_session_lectures(lecture_id);

CREATE INDEX IF NOT EXISTS idx_revision_history_user ON public.revision_history(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_history_lecture ON public.revision_history(lecture_id);
CREATE INDEX IF NOT EXISTS idx_revision_history_next_date ON public.revision_history(next_revision_date);

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date ON public.study_tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_status ON public.study_tasks(status);

-- 6. TRIGGERS FOR updated_at
DROP TRIGGER IF EXISTS set_revision_sessions_updated_at ON public.revision_sessions;
CREATE TRIGGER set_revision_sessions_updated_at
    BEFORE UPDATE ON public.revision_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_study_tasks_updated_at ON public.study_tasks;
CREATE TRIGGER set_study_tasks_updated_at
    BEFORE UPDATE ON public.study_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_session_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;

-- revision_sessions policies
DROP POLICY IF EXISTS "Users can view own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can view own revision sessions"
    ON public.revision_sessions FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can insert own revision sessions"
    ON public.revision_sessions FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can update own revision sessions"
    ON public.revision_sessions FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can delete own revision sessions"
    ON public.revision_sessions FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- revision_session_lectures policies (via parent session user_id check)
DROP POLICY IF EXISTS "Users can view own session lectures" ON public.revision_session_lectures;
CREATE POLICY "Users can view own session lectures"
    ON public.revision_session_lectures FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.revision_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can insert own session lectures" ON public.revision_session_lectures;
CREATE POLICY "Users can insert own session lectures"
    ON public.revision_session_lectures FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.revision_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can update own session lectures" ON public.revision_session_lectures;
CREATE POLICY "Users can update own session lectures"
    ON public.revision_session_lectures FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.revision_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can delete own session lectures" ON public.revision_session_lectures;
CREATE POLICY "Users can delete own session lectures"
    ON public.revision_session_lectures FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.revision_sessions s
        WHERE s.id = session_id AND s.user_id = auth.uid()
    ));

-- revision_history policies
DROP POLICY IF EXISTS "Users can view own revision history" ON public.revision_history;
CREATE POLICY "Users can view own revision history"
    ON public.revision_history FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own revision history" ON public.revision_history;
CREATE POLICY "Users can insert own revision history"
    ON public.revision_history FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own revision history" ON public.revision_history;
CREATE POLICY "Users can delete own revision history"
    ON public.revision_history FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- study_tasks policies
DROP POLICY IF EXISTS "Users can view own study tasks" ON public.study_tasks;
CREATE POLICY "Users can view own study tasks"
    ON public.study_tasks FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own study tasks" ON public.study_tasks;
CREATE POLICY "Users can insert own study tasks"
    ON public.study_tasks FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own study tasks" ON public.study_tasks;
CREATE POLICY "Users can update own study tasks"
    ON public.study_tasks FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own study tasks" ON public.study_tasks;
CREATE POLICY "Users can delete own study tasks"
    ON public.study_tasks FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

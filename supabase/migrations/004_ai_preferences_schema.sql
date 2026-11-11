-- ==============================================================================
-- MTS COMPANION — AI CAPABILITIES: USER PREFERENCES & CONSENT SCHEMA
-- ==============================================================================

-- 1. USER AI PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.user_ai_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_version TEXT NOT NULL DEFAULT '1.0',
    consented_at TIMESTAMPTZ,
    ai_enabled BOOLEAN NOT NULL DEFAULT true,
    preferred_model TEXT DEFAULT 'gemini-2.5-flash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. PERFORMANCE INDEX
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON public.user_ai_preferences(user_id);

-- 3. TRIGGER FOR updated_at
DROP TRIGGER IF EXISTS set_user_ai_preferences_updated_at ON public.user_ai_preferences;
CREATE TRIGGER set_user_ai_preferences_updated_at
    BEFORE UPDATE ON public.user_ai_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI preferences" ON public.user_ai_preferences;
CREATE POLICY "Users can view own AI preferences"
    ON public.user_ai_preferences
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own AI preferences" ON public.user_ai_preferences;
CREATE POLICY "Users can insert own AI preferences"
    ON public.user_ai_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own AI preferences" ON public.user_ai_preferences;
CREATE POLICY "Users can update own AI preferences"
    ON public.user_ai_preferences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

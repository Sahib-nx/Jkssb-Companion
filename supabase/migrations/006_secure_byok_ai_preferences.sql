-- ==============================================================================
-- MTS COMPANION — PHASE 6: SECURE GEMINI BYOK & USER AI PREFERENCES
-- ==============================================================================

-- 1. CREATE OR ALTER user_ai_preferences TABLE
CREATE TABLE IF NOT EXISTS public.user_ai_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ai_enabled BOOLEAN NOT NULL DEFAULT false,
    provider TEXT NOT NULL DEFAULT 'gemini',
    encrypted_api_key TEXT,
    encryption_iv TEXT,
    encryption_auth_tag TEXT,
    encryption_version TEXT NOT NULL DEFAULT 'v1',
    key_hint TEXT,
    consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_version TEXT NOT NULL DEFAULT '1.0',
    consented_at TIMESTAMPTZ,
    configured_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    preferred_model TEXT DEFAULT 'gemini-3.5-flash-lite',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist idempotently if table already existed
ALTER TABLE public.user_ai_preferences
    ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gemini',
    ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT,
    ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
    ADD COLUMN IF NOT EXISTS encryption_auth_tag TEXT,
    ADD COLUMN IF NOT EXISTS encryption_version TEXT NOT NULL DEFAULT 'v1',
    ADD COLUMN IF NOT EXISTS key_hint TEXT,
    ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS consent_version TEXT NOT NULL DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS configured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'gemini-3.5-flash-lite',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 2. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON public.user_ai_preferences(user_id);

-- 3. TRIGGER FOR updated_at
CREATE OR REPLACE FUNCTION public.handle_ai_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_ai_preferences_updated_at ON public.user_ai_preferences;
CREATE TRIGGER set_user_ai_preferences_updated_at
    BEFORE UPDATE ON public.user_ai_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_ai_preferences_updated_at();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
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

DROP POLICY IF EXISTS "Users can delete own AI preferences" ON public.user_ai_preferences;
CREATE POLICY "Users can delete own AI preferences"
    ON public.user_ai_preferences
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. GRANTS FOR POSTGREST ACCESS
GRANT ALL ON public.user_ai_preferences TO authenticated;
GRANT ALL ON public.user_ai_preferences TO service_role;

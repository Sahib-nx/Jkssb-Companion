-- ==============================================================================
-- Migration 010: AI Analytics Assistant for Study Companion
-- ==============================================================================

-- 1. Create table for conversational analytics messages, deterministic insights, and proposals
CREATE TABLE IF NOT EXISTS public.analytics_assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    insights JSONB DEFAULT NULL,
    proposal JSONB DEFAULT NULL,
    suggested_follow_ups JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_analytics_assistant_messages_user_created 
ON public.analytics_assistant_messages(user_id, created_at ASC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.analytics_assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own analytics assistant messages" ON public.analytics_assistant_messages;
CREATE POLICY "Users can view their own analytics assistant messages"
    ON public.analytics_assistant_messages FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own analytics assistant messages" ON public.analytics_assistant_messages;
CREATE POLICY "Users can insert their own analytics assistant messages"
    ON public.analytics_assistant_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own analytics assistant messages" ON public.analytics_assistant_messages;
CREATE POLICY "Users can update their own analytics assistant messages"
    ON public.analytics_assistant_messages FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own analytics assistant messages" ON public.analytics_assistant_messages;
CREATE POLICY "Users can delete their own analytics assistant messages"
    ON public.analytics_assistant_messages FOR DELETE
    USING (auth.uid() = user_id);

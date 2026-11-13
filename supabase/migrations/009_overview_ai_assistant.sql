-- ==============================================================================
-- Migration 009: Overview AI Assistant ("Ask Study Companion")
-- ==============================================================================

-- 1. Create table for conversational overview messages and proposals
CREATE TABLE IF NOT EXISTS public.overview_assistant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    proposal JSONB DEFAULT NULL,
    suggested_follow_ups JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_overview_assistant_messages_user_created 
ON public.overview_assistant_messages(user_id, created_at ASC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.overview_assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own overview assistant messages" ON public.overview_assistant_messages;
CREATE POLICY "Users can view their own overview assistant messages"
    ON public.overview_assistant_messages FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own overview assistant messages" ON public.overview_assistant_messages;
CREATE POLICY "Users can insert their own overview assistant messages"
    ON public.overview_assistant_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own overview assistant messages" ON public.overview_assistant_messages;
CREATE POLICY "Users can update their own overview assistant messages"
    ON public.overview_assistant_messages FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own overview assistant messages" ON public.overview_assistant_messages;
CREATE POLICY "Users can delete their own overview assistant messages"
    ON public.overview_assistant_messages FOR DELETE
    USING (auth.uid() = user_id);

-- ========================================================================
-- Rented Thikanaa Migration: Chat Realtime Publications, Read Status & RLS
-- Date: 2026-10-12
-- ========================================================================

-- 1. Ensure public.messages has recipient UPDATE policy
DROP POLICY IF EXISTS "messages_recipient_update" ON public.messages;
CREATE POLICY "messages_recipient_update" ON public.messages
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = receiver_id)
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = receiver_id)
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 2. Ensure public.conversations has participant UPDATE policy
DROP POLICY IF EXISTS "conversations_participant_update" ON public.conversations;
CREATE POLICY "conversations_participant_update" ON public.conversations
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = participant_a OR auth.uid() = participant_b))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND (auth.uid() = participant_a OR auth.uid() = participant_b))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 3. Set REPLICA IDENTITY FULL for robust real-time updates and payload filters
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 4. Ensure public.messages and public.conversations are in supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

-- 5. Atomic RPC function to mark conversation messages as read
CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(p_conversation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND receiver_id = auth.uid()
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_as_read(UUID) TO authenticated;

-- 6. Indexes for ultra-fast unread queries
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread 
  ON public.messages (receiver_id, is_read) 
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON public.messages (conversation_id, created_at);

-- ========================================================================
-- Rented Thikan Migration: Message Read Status & Recipient Update RLS
-- Date: 2026-09-27
-- ========================================================================

-- Allow message recipients to mark incoming messages as read (and service_role / super admin)
DROP POLICY IF EXISTS "messages_recipient_update" ON public.messages;
CREATE POLICY "messages_recipient_update" ON public.messages
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = receiver_id)
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- Create an index to make unread message queries lightning-fast
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread 
  ON public.messages (receiver_id, is_read) 
  WHERE is_read = false;

-- Migration: 20260923_auth_profiles_and_chat_rls.sql
-- Description: Synchronize Google OAuth auth.users to public.profiles, and tighten RLS on messages, conversations, and contact_requests to strictly require authenticated users.

-- 1. Automatic Google Profile Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_full_name text;
  v_avatar_url text;
BEGIN
  v_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(COALESCE(new.email, 'User'), '@', 1)
  );

  v_avatar_url := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    NULL
  );

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    account_type,
    phone_privacy,
    is_verified,
    is_blocked,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    v_full_name,
    v_avatar_url,
    'user'::public.account_type_enum,
    'private'::public.phone_privacy_level,
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user warning: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tighten Messages RLS (Disallow anonymous inserts; require authenticated sender matching auth.uid())
DROP POLICY IF EXISTS "messages_sender_insert" ON public.messages;
CREATE POLICY "messages_sender_insert" ON public.messages
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = sender_id)
    OR auth.role() = 'service_role'
  );

-- 3. Tighten Conversations RLS (Disallow anonymous inserts; require authenticated participant)
DROP POLICY IF EXISTS "conversations_participant_insert" ON public.conversations;
CREATE POLICY "conversations_participant_insert" ON public.conversations
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND (auth.uid() = participant_a OR auth.uid() = participant_b))
    OR auth.role() = 'service_role'
  );

-- 4. Tighten Contact Requests RLS (Disallow anonymous inserts; require authenticated requester)
DROP POLICY IF EXISTS "contact_requests_requester_insert" ON public.contact_requests;
CREATE POLICY "contact_requests_requester_insert" ON public.contact_requests
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = requester_id)
    OR auth.role() = 'service_role'
  );

-- 5. Saved Properties RLS (Enforce auth.uid() = user_id)
DROP POLICY IF EXISTS "saved_properties_owner_manage" ON public.saved_properties;
CREATE POLICY "saved_properties_owner_manage" ON public.saved_properties
  FOR ALL USING (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
  );

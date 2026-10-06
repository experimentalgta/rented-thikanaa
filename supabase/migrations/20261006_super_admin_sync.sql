-- ============================================================================
-- Migration: 20261006_super_admin_sync.sql
-- Description: Synchronize Super Admin roles between public.profiles and public.super_admins,
--              and update public.is_super_admin() to check both tables securely.
-- ============================================================================

-- 1. Ensure super_admins table exists
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- 2. Populate super_admins with any user having account_type = 'super_admin'
INSERT INTO public.super_admins (user_id)
SELECT id FROM public.profiles WHERE account_type = 'super_admin'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Enhance is_super_admin to check both super_admins table and profiles.account_type
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.super_admins WHERE super_admins.user_id = user_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = user_id AND profiles.account_type = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Policy: Allow Super Admins to view and manage super_admins table
DROP POLICY IF EXISTS "super_admins_self_select" ON public.super_admins;
CREATE POLICY "super_admins_self_select" ON public.super_admins
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "super_admins_admin_insert" ON public.super_admins;
CREATE POLICY "super_admins_admin_insert" ON public.super_admins
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "super_admins_admin_delete" ON public.super_admins;
CREATE POLICY "super_admins_admin_delete" ON public.super_admins
  FOR DELETE USING (
    public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 5. RLS Policy for Profiles: Super Admins can select and manage all profiles
DROP POLICY IF EXISTS "profiles_admin_all_select" ON public.profiles;
CREATE POLICY "profiles_admin_all_select" ON public.profiles
  FOR SELECT USING (
    is_blocked = false
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

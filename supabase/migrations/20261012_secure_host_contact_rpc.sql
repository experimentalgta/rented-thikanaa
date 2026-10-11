-- ==============================================================================
-- Rented Thikanaa Migration: Secure Authentication-Gated Host Contact Details RPC
-- Date: 2026-10-12
-- ==============================================================================

-- 1. Create secure server-side RPC function to disclose host contact details
-- Strictly requires a valid authenticated session (auth.uid() IS NOT NULL).
-- Never reveals private host phone numbers to anonymous callers or when host kept phone private.

CREATE OR REPLACE FUNCTION public.get_property_contact_details(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_property record;
  v_owner_profile record;
  v_phone text;
  v_show_phone boolean;
  v_is_owner boolean := false;
  v_is_admin boolean := false;
BEGIN
  -- 1. Extract verified caller ID from auth JWT token
  v_caller_id := auth.uid();
  
  -- 2. Strictly enforce authentication: Anonymous callers are rejected
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'reason', 'unauthenticated',
      'message', 'Please sign in to access host contact details.'
    );
  END IF;

  -- 3. Retrieve property record
  SELECT id, owner_id, created_by, phone_number, show_phone_number, phone_privacy, availability_status
  INTO v_property
  FROM public.properties
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'reason', 'not_found',
      'message', 'Property listing not found.'
    );
  END IF;

  -- 4. Check if caller owns this listing
  IF v_caller_id = v_property.owner_id OR (v_property.created_by IS NOT NULL AND v_caller_id = v_property.created_by) THEN
    v_is_owner := true;
  END IF;

  -- Check if caller is super admin
  IF public.is_super_admin(v_caller_id) THEN
    v_is_admin := true;
  END IF;

  -- Retrieve owner profile if needed for fallback phone
  SELECT phone_number, phone_privacy INTO v_owner_profile
  FROM public.profiles
  WHERE id = v_property.owner_id;

  -- Resolve active phone number and visibility choice
  v_phone := COALESCE(v_property.phone_number, v_owner_profile.phone_number);
  v_show_phone := COALESCE(
    v_property.show_phone_number,
    v_property.phone_privacy = 'public',
    v_owner_profile.phone_privacy = 'public',
    false
  );

  -- 5. If caller is the listing owner: return owner state
  IF v_is_owner THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_owner', true,
      'is_admin', v_is_admin,
      'phone_number', v_phone,
      'show_phone_number', v_show_phone,
      'phone_privacy', CASE WHEN v_show_phone THEN 'public' ELSE 'private' END
    );
  END IF;

  -- 6. If caller is super admin: return admin view
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_owner', false,
      'is_admin', true,
      'phone_number', v_phone,
      'show_phone_number', v_show_phone,
      'phone_privacy', CASE WHEN v_show_phone THEN 'public' ELSE 'private' END
    );
  END IF;

  -- 7. If caller is an authenticated student / renter:
  -- Disclose phone ONLY if host explicitly permitted it (show_phone_number = true)
  IF v_show_phone AND v_phone IS NOT NULL AND LENGTH(TRIM(v_phone)) > 0 THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_owner', false,
      'is_admin', false,
      'phone_number', v_phone,
      'show_phone_number', true,
      'phone_privacy', 'public'
    );
  ELSE
    RETURN jsonb_build_object(
      'authorized', false,
      'is_owner', false,
      'is_admin', false,
      'phone_number', null,
      'show_phone_number', false,
      'phone_privacy', 'private',
      'reason', 'phone_private',
      'message', 'Phone number is kept private by host. Contact is available via in-app chat.'
    );
  END IF;
END;
$$;

-- 2. Restrict execution permissions: Only authenticated users can call this RPC
REVOKE EXECUTE ON FUNCTION public.get_property_contact_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_property_contact_details(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_property_contact_details(uuid) IS 
  'Secure server-side RPC that validates caller authentication and discloses host contact details only when authorized.';

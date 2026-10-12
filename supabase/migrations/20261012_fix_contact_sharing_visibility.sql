-- ==============================================================================
-- Rented Thikanaa Migration: Fix Contact Sharing Visibility & Permissions
-- Date: 2026-10-12
-- ==============================================================================

-- 1. Create or replace public.get_property_contact_details RPC with comprehensive
-- support for direct public visibility AND mutual/explicit contact sharing.
--
-- Discloses host contact details ONLY under strict privacy rules:
--   a) Caller is the listing owner or created_by
--   b) Caller is a Super Admin
--   c) Host enabled public phone on property or profile
--   d) Host explicitly shared contact with caller (accepted contact_requests or in-chat share)
-- NEVER reveals private contact to unauthenticated visitors or unauthorized 3rd parties.

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
  v_owner_id uuid;
  v_phone text;
  v_show_phone boolean := false;
  v_is_shared boolean := false;
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

  -- Resolve definitive owner UUID
  v_owner_id := COALESCE(v_property.owner_id, v_property.created_by);

  -- 4. Check if caller owns this listing
  IF v_caller_id = v_property.owner_id OR (v_property.created_by IS NOT NULL AND v_caller_id = v_property.created_by) THEN
    v_is_owner := true;
  END IF;

  -- Check if caller is super admin
  IF public.is_super_admin(v_caller_id) THEN
    v_is_admin := true;
  END IF;

  -- Retrieve owner profile if needed for fallback phone and privacy
  IF v_owner_id IS NOT NULL THEN
    SELECT phone_number, phone_privacy INTO v_owner_profile
    FROM public.profiles
    WHERE id = v_owner_id;
  END IF;

  -- Resolve active phone number (sanitized)
  v_phone := COALESCE(
    NULLIF(TRIM(v_property.phone_number), ''),
    NULLIF(TRIM(v_owner_profile.phone_number), '')
  );

  -- Check if phone is globally public across property flags or profile setting
  -- NOTE: We explicitly evaluate all conditions with OR to avoid COALESCE short-circuiting on boolean false!
  v_show_phone := (
    (v_property.show_phone_number IS TRUE)
    OR (v_property.phone_privacy = 'public')
    OR (v_owner_profile.phone_privacy = 'public')
  );

  -- 5. If caller is the listing owner: return owner state
  IF v_is_owner THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_owner', true,
      'is_admin', v_is_admin,
      'is_shared', false,
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
      'is_shared', false,
      'phone_number', v_phone,
      'show_phone_number', v_show_phone,
      'phone_privacy', CASE WHEN v_show_phone THEN 'public' ELSE 'private' END
    );
  END IF;

  -- 7. If phone is NOT globally public, check if host has explicitly shared contact with this caller
  IF NOT v_show_phone AND v_owner_id IS NOT NULL THEN
    -- Check 7a: Accepted contact request for this property or between these users
    SELECT EXISTS (
      SELECT 1 FROM public.contact_requests cr
      WHERE (cr.property_id = p_property_id OR cr.property_id IS NULL)
        AND cr.status = 'accepted'
        AND (
          (cr.requester_id = v_caller_id AND cr.receiver_id = v_owner_id)
          OR (cr.receiver_id = v_caller_id AND cr.requester_id = v_owner_id)
        )
    ) INTO v_is_shared;

    -- Check 7b: Conversation where host sent an exact location/contact share message
    IF NOT v_is_shared THEN
      SELECT EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversations c ON m.conversation_id = c.id
        WHERE (c.property_id = p_property_id OR c.property_id IS NULL)
          AND (
            (c.participant_a = v_caller_id AND c.participant_b = v_owner_id)
            OR (c.participant_b = v_caller_id AND c.participant_a = v_owner_id)
          )
          AND m.sender_id = v_owner_id
          AND (
            m.location_share IS NOT NULL
            OR m.text ILIKE '%contact%'
            OR m.text ILIKE '%wa.me%'
            OR m.text ILIKE '%location shared%'
          )
      ) INTO v_is_shared;
    END IF;
  END IF;

  -- 8. Disclose phone if globally public OR explicitly shared with caller
  IF (v_show_phone OR v_is_shared) AND v_phone IS NOT NULL AND LENGTH(TRIM(v_phone)) > 0 THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'is_owner', false,
      'is_admin', false,
      'is_shared', v_is_shared,
      'phone_number', v_phone,
      'show_phone_number', true,
      'phone_privacy', CASE WHEN v_show_phone THEN 'public' ELSE 'shared' END
    );
  ELSE
    RETURN jsonb_build_object(
      'authorized', false,
      'is_owner', false,
      'is_admin', false,
      'is_shared', false,
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

-- 3. Ensure contact_requests table has appropriate index for contact sharing lookups
CREATE INDEX IF NOT EXISTS idx_contact_requests_sharing_lookup
  ON public.contact_requests (property_id, requester_id, receiver_id, status);

COMMENT ON FUNCTION public.get_property_contact_details(uuid) IS 
  'Secure server-side RPC that validates caller authentication and discloses host contact details when publicly enabled or intentionally shared with the caller.';

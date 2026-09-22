-- ========================================================================
-- Rented Thikan Production Database Migration: RLS & Proximity Functions
-- Date: 2026-09-22
-- ========================================================================

-- 1. GEO REFERENCE DATA RLS
DO $$ BEGIN
  ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.geo_states ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.geo_districts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.geo_cities ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.geo_localities ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.geo_landmarks ENABLE ROW LEVEL SECURITY;
END $$;

DROP POLICY IF EXISTS "geo_countries_public_select" ON public.geo_countries;
CREATE POLICY "geo_countries_public_select" ON public.geo_countries FOR SELECT USING (true);

DROP POLICY IF EXISTS "geo_states_public_select" ON public.geo_states;
CREATE POLICY "geo_states_public_select" ON public.geo_states FOR SELECT USING (true);

DROP POLICY IF EXISTS "geo_districts_public_select" ON public.geo_districts;
CREATE POLICY "geo_districts_public_select" ON public.geo_districts FOR SELECT USING (true);

DROP POLICY IF EXISTS "geo_cities_public_select" ON public.geo_cities;
CREATE POLICY "geo_cities_public_select" ON public.geo_cities FOR SELECT USING (true);

DROP POLICY IF EXISTS "geo_localities_public_select" ON public.geo_localities;
CREATE POLICY "geo_localities_public_select" ON public.geo_localities FOR SELECT USING (true);

DROP POLICY IF EXISTS "geo_landmarks_public_select" ON public.geo_landmarks;
CREATE POLICY "geo_landmarks_public_select" ON public.geo_landmarks FOR SELECT USING (true);

-- 2. PROPERTIES RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties_public_select" ON public.properties;
CREATE POLICY "properties_public_select" ON public.properties
  FOR SELECT USING (availability_status IN ('available', 'limited', 'rented'));

DROP POLICY IF EXISTS "properties_owner_admin_select" ON public.properties;
CREATE POLICY "properties_owner_admin_select" ON public.properties
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = owner_id OR auth.uid() = created_by))
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "properties_authenticated_insert" ON public.properties;
CREATE POLICY "properties_authenticated_insert" ON public.properties
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
    OR is_demo = true
  );

DROP POLICY IF EXISTS "properties_owner_admin_update" ON public.properties;
CREATE POLICY "properties_owner_admin_update" ON public.properties
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = owner_id OR auth.uid() = created_by))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "properties_owner_admin_delete" ON public.properties;
CREATE POLICY "properties_owner_admin_delete" ON public.properties
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = owner_id OR auth.uid() = created_by))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 3. PROPERTY IMAGES RLS
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_images_public_select" ON public.property_images;
CREATE POLICY "property_images_public_select" ON public.property_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id
      AND (
        p.availability_status IN ('available', 'limited', 'rented')
        OR (auth.uid() IS NOT NULL AND (p.owner_id = auth.uid() OR p.created_by = auth.uid()))
        OR public.is_super_admin(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "property_images_owner_insert" ON public.property_images;
CREATE POLICY "property_images_owner_insert" ON public.property_images
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id
      AND (
        (auth.uid() IS NOT NULL AND (p.owner_id = auth.uid() OR p.created_by = auth.uid()))
        OR public.is_super_admin(auth.uid())
        OR p.is_demo = true
      )
    )
  );

DROP POLICY IF EXISTS "property_images_owner_update" ON public.property_images;
CREATE POLICY "property_images_owner_update" ON public.property_images
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id
      AND (
        (auth.uid() IS NOT NULL AND (p.owner_id = auth.uid() OR p.created_by = auth.uid()))
        OR public.is_super_admin(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "property_images_owner_delete" ON public.property_images;
CREATE POLICY "property_images_owner_delete" ON public.property_images
  FOR DELETE USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id
      AND (
        (auth.uid() IS NOT NULL AND (p.owner_id = auth.uid() OR p.created_by = auth.uid()))
        OR public.is_super_admin(auth.uid())
      )
    )
  );

-- 4. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
CREATE POLICY "profiles_public_select" ON public.profiles
  FOR SELECT USING (is_blocked = false);

DROP POLICY IF EXISTS "profiles_user_insert" ON public.profiles;
CREATE POLICY "profiles_user_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR auth.role() = 'service_role'
    OR account_type = 'user'
  );

DROP POLICY IF EXISTS "profiles_user_update" ON public.profiles;
CREATE POLICY "profiles_user_update" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 5. STUDENT PROFILES RLS
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_profiles_public_select" ON public.student_profiles;
CREATE POLICY "student_profiles_public_select" ON public.student_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "student_profiles_user_insert" ON public.student_profiles;
CREATE POLICY "student_profiles_user_insert" ON public.student_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
    OR is_demo = true
  );

DROP POLICY IF EXISTS "student_profiles_user_update" ON public.student_profiles;
CREATE POLICY "student_profiles_user_update" ON public.student_profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 6. CONTACT REQUESTS RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_requests_participant_select" ON public.contact_requests;
CREATE POLICY "contact_requests_participant_select" ON public.contact_requests
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = requester_id OR auth.uid() = receiver_id))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "contact_requests_requester_insert" ON public.contact_requests;
CREATE POLICY "contact_requests_requester_insert" ON public.contact_requests
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = requester_id)
    OR auth.role() = 'service_role'
    OR auth.role() = 'anon'
  );

DROP POLICY IF EXISTS "contact_requests_receiver_update" ON public.contact_requests;
CREATE POLICY "contact_requests_receiver_update" ON public.contact_requests
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = receiver_id OR auth.uid() = requester_id))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 7. CONVERSATIONS & MESSAGES RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_participant_select" ON public.conversations;
CREATE POLICY "conversations_participant_select" ON public.conversations
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = participant_a OR auth.uid() = participant_b))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "conversations_participant_insert" ON public.conversations;
CREATE POLICY "conversations_participant_insert" ON public.conversations
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND (auth.uid() = participant_a OR auth.uid() = participant_b))
    OR auth.role() = 'service_role'
    OR auth.role() = 'anon'
  );

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_participant_select" ON public.messages;
CREATE POLICY "messages_participant_select" ON public.messages
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "messages_sender_insert" ON public.messages;
CREATE POLICY "messages_sender_insert" ON public.messages
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = sender_id)
    OR auth.role() = 'service_role'
    OR auth.role() = 'anon'
  );

-- 8. SAVED PROPERTIES RLS
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_properties_owner_manage" ON public.saved_properties;
CREATE POLICY "saved_properties_owner_manage" ON public.saved_properties
  FOR ALL USING (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
  );

-- 9. REPORTS RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_anyone_insert" ON public.reports;
CREATE POLICY "reports_anyone_insert" ON public.reports
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reports_super_admin_manage" ON public.reports;
CREATE POLICY "reports_super_admin_manage" ON public.reports
  FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 10. SUPER ADMINS RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_self_select" ON public.super_admins;
CREATE POLICY "super_admins_self_select" ON public.super_admins
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_super_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- 11. ENHANCED POSTGIS PROXIMITY STORED PROCEDURE
DROP FUNCTION IF EXISTS public.get_properties_proximity_ranked(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_properties_proximity_ranked(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.get_properties_proximity_ranked(
  ref_lat DOUBLE PRECISION,
  ref_lon DOUBLE PRECISION,
  filter_gender TEXT DEFAULT NULL,
  filter_prop_type TEXT DEFAULT NULL,
  filter_max_rent INTEGER DEFAULT NULL,
  filter_city TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  title TEXT,
  slug TEXT,
  description TEXT,
  property_type property_type_enum,
  gender_preference gender_enum,
  room_type TEXT,
  rent INTEGER,
  security_deposit INTEGER,
  electricity_billing TEXT,
  maintenance_fee INTEGER,
  available_from TEXT,
  vacancies INTEGER,
  floor INTEGER,
  total_floors INTEGER,
  furnishing_status TEXT,
  attached_bathroom BOOLEAN,
  balcony BOOLEAN,
  availability_status availability_enum,
  is_verified BOOLEAN,
  verification_badge TEXT,
  is_featured BOOLEAN,
  is_demo BOOLEAN,
  locality TEXT,
  sub_locality TEXT,
  landmark TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  address TEXT,
  amenities TEXT[],
  rules TEXT[],
  phone_privacy phone_privacy_level,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  images JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.owner_id,
    p.title,
    p.slug,
    p.description,
    p.property_type,
    p.gender_preference,
    p.room_type,
    p.rent,
    p.security_deposit,
    p.electricity_billing,
    p.maintenance_fee,
    p.available_from,
    p.vacancies,
    p.floor,
    p.total_floors,
    p.furnishing_status,
    p.attached_bathroom,
    p.balcony,
    p.availability_status,
    p.is_verified,
    p.verification_badge,
    p.is_featured,
    p.is_demo,
    p.locality,
    p.sub_locality,
    p.landmark,
    p.city,
    p.state,
    p.pincode,
    p.address,
    p.amenities,
    p.rules,
    p.phone_privacy,
    ST_Y(p.location::geometry) AS latitude,
    ST_X(p.location::geometry) AS longitude,
    ST_Distance(p.location, ST_SetSRID(ST_MakePoint(ref_lon, ref_lat), 4326)::geography) AS distance_meters,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'url', pi.url,
            'caption', pi.caption,
            'is_cover', pi.is_cover,
            'sort_order', pi.sort_order
          ) ORDER BY pi.sort_order ASC
        )
        FROM public.property_images pi
        WHERE pi.property_id = p.id
      ),
      '[]'::jsonb
    ) AS images
  FROM public.properties p
  WHERE
    p.availability_status IN ('available', 'limited')
    AND (filter_gender IS NULL OR filter_gender = 'any' OR p.gender_preference = 'any' OR p.gender_preference::text = filter_gender)
    AND (filter_prop_type IS NULL OR filter_prop_type = 'all' OR p.property_type::text = filter_prop_type)
    AND (filter_max_rent IS NULL OR p.rent <= filter_max_rent)
    AND (filter_city IS NULL OR filter_city = 'all' OR LOWER(p.city) = LOWER(filter_city))
  ORDER BY
    distance_meters ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_properties_proximity_ranked TO anon, authenticated, service_role;

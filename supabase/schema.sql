-- ========================================================================
-- Rented Thikan Production PostgreSQL & PostGIS Database Schema
-- Scalable India-Wide Room, Property & Roommate Discovery Marketplace
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 0. NORMALIZED ALL-INDIA GEOGRAPHIC HIERARCHY (OSM / PostGIS)
-- Country -> State/UT -> District -> City/Town -> Locality/Area -> Landmark
CREATE TABLE IF NOT EXISTS public.geo_countries (
  code TEXT PRIMARY KEY, -- 'IN'
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.geo_states (
  code TEXT PRIMARY KEY, -- 'UP', 'MH', 'KA', 'DL', etc.
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'state', -- 'state' or 'ut'
  slug TEXT NOT NULL UNIQUE,
  capital TEXT,
  region TEXT
);

CREATE TABLE IF NOT EXISTS public.geo_districts (
  id TEXT PRIMARY KEY,
  state_code TEXT NOT NULL REFERENCES public.geo_states(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.geo_cities (
  id TEXT PRIMARY KEY,
  district_id TEXT REFERENCES public.geo_districts(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL REFERENCES public.geo_states(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_popular BOOLEAN DEFAULT false,
  location GEOGRAPHY(POINT, 4326)
);

CREATE TABLE IF NOT EXISTS public.geo_localities (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  district_id TEXT REFERENCES public.geo_districts(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL REFERENCES public.geo_states(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  pincode TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326)
);

CREATE TABLE IF NOT EXISTS public.geo_landmarks (
  id TEXT PRIMARY KEY,
  locality_id TEXT REFERENCES public.geo_localities(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL REFERENCES public.geo_states(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  category TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326)
);

CREATE INDEX IF NOT EXISTS idx_geo_cities_location ON public.geo_cities USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_geo_localities_location ON public.geo_localities USING GIST (location);

-- 1. USERS & ROLES
CREATE TYPE account_type_enum AS ENUM ('user', 'super_admin');
CREATE TYPE user_role AS ENUM ('member', 'admin'); -- Legacy support
CREATE TYPE phone_privacy_level AS ENUM ('private', 'on_request', 'public');
CREATE TYPE contact_request_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE property_type_enum AS ENUM ('room', 'pg', 'hostel', 'flat', 'homestay', 'shared_room');
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'any');
CREATE TYPE availability_enum AS ENUM ('available', 'limited', 'rented', 'paused', 'expired');

-- Protected Super Admin table (Server-side authorization only; no public write)
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Helper function to verify super admin access without trusting client payloads
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.super_admins WHERE super_admins.user_id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  account_type account_type_enum NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  phone_privacy phone_privacy_level NOT NULL DEFAULT 'private',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  college TEXT,
  occupation TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STUDENT PROFILES (Roommate Discovery & Preferences)
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  college TEXT NOT NULL,
  course TEXT,
  academic_year TEXT,
  target_move_in TEXT,
  budget_min INTEGER NOT NULL DEFAULT 3500,
  budget_max INTEGER NOT NULL DEFAULT 7000,
  preferred_areas TEXT[] NOT NULL DEFAULT '{}',
  lifestyle JSONB NOT NULL DEFAULT '{"sleep_schedule": "early_bird", "dietary": "veg", "smoking": "non_smoker", "quiet_study": true, "cleanliness": "high"}',
  bio TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PROPERTIES (Geospatial PostGIS Points)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lister_type TEXT DEFAULT 'individual',
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  property_type property_type_enum NOT NULL DEFAULT 'pg',
  gender_preference gender_enum NOT NULL DEFAULT 'any',
  room_type TEXT NOT NULL DEFAULT 'single',
  rent INTEGER NOT NULL,
  security_deposit INTEGER NOT NULL DEFAULT 0,
  electricity_billing TEXT NOT NULL DEFAULT 'included',
  maintenance_fee INTEGER NOT NULL DEFAULT 0,
  available_from TEXT NOT NULL DEFAULT 'Immediately',
  vacancies INTEGER NOT NULL DEFAULT 1,
  floor INTEGER DEFAULT 1,
  total_floors INTEGER DEFAULT 2,
  furnishing_status TEXT NOT NULL DEFAULT 'semi_furnished',
  attached_bathroom BOOLEAN NOT NULL DEFAULT false,
  balcony BOOLEAN NOT NULL DEFAULT false,
  availability_status availability_enum NOT NULL DEFAULT 'available',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_badge TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  
  -- Location (Exact coordinates strictly retained in database)
  locality TEXT NOT NULL,
  sub_locality TEXT,
  landmark TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL, -- Exact Lat/Lon point
  
  amenities TEXT[] NOT NULL DEFAULT '{}',
  rules TEXT[] NOT NULL DEFAULT '{}',
  phone_privacy phone_privacy_level NOT NULL DEFAULT 'private',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for sub-millisecond proximity queries
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_properties_locality ON public.properties(locality);
CREATE INDEX IF NOT EXISTS idx_properties_rent ON public.properties(rent);

-- 4. PROPERTY IMAGES
CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CONTACT REQUESTS (Phone Privacy Gatekeeper)
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status contact_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_property_contact_request UNIQUE (property_id, requester_id, receiver_id)
);

-- 6. CONVERSATIONS & IN-APP MESSAGING
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_title TEXT,
  last_message TEXT,
  last_message_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_conversation_participants UNIQUE (participant_a, participant_b, property_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  property_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SAVED PROPERTIES
CREATE TABLE IF NOT EXISTS public.saved_properties (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  saved_price INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, property_id)
);

-- 8. REPORTS & MODERATION
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_entity_type TEXT NOT NULL,
  reported_entity_id UUID NOT NULL,
  reported_entity_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================================
-- POSTGIS PROXIMITY FUNCTION (Anti-Leapfrogging Ordering)
-- Computes geodesic distance from reference coordinates and ranks by distance.
-- ========================================================================
CREATE OR REPLACE FUNCTION get_properties_proximity_ranked(
  ref_lat DOUBLE PRECISION,
  ref_lon DOUBLE PRECISION,
  filter_gender TEXT DEFAULT NULL,
  filter_prop_type TEXT DEFAULT NULL,
  filter_max_rent INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  locality TEXT,
  property_type property_type_enum,
  gender_preference gender_enum,
  rent INTEGER,
  distance_meters DOUBLE PRECISION,
  is_verified BOOLEAN,
  is_featured BOOLEAN,
  availability_status availability_enum
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.locality,
    p.property_type,
    p.gender_preference,
    p.rent,
    ST_Distance(p.location, ST_SetSRID(ST_MakePoint(ref_lon, ref_lat), 4326)::geography) AS distance_meters,
    p.is_verified,
    p.is_featured,
    p.availability_status
  FROM public.properties p
  WHERE
    p.availability_status IN ('available', 'limited')
    AND (filter_gender IS NULL OR p.gender_preference = 'any' OR p.gender_preference::text = filter_gender)
    AND (filter_prop_type IS NULL OR p.property_type::text = filter_prop_type)
    AND (filter_max_rent IS NULL OR p.rent <= filter_max_rent)
  ORDER BY
    distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

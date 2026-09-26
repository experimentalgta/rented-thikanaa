export type AccountType = 'user' | 'super_admin';
export type UserRole = 'member' | 'student' | 'owner' | 'admin';

export type PhonePrivacy = 'private' | 'on_request' | 'public';
export type ContactRequestStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export interface User {
  id: string;
  email: string;
  full_name: string;
  account_type: AccountType;
  role?: UserRole | string; // Backwards compatibility
  avatar_url?: string;
  phone_number?: string;
  is_verified: boolean;
  is_blocked?: boolean;
  created_at: string;
  // Optional profile attributes
  college?: string;
  occupation?: string;
  bio?: string;
  preferred_areas?: string[];
  budget?: number;
}

export interface StudentLifestyle {
  sleep_schedule: 'early_bird' | 'night_owl' | 'flexible';
  dietary: 'veg' | 'non_veg' | 'jain';
  smoking: 'non_smoker' | 'smoker';
  quiet_study: boolean;
  cleanliness: 'high' | 'moderate';
  visitors: 'occasional' | 'rare' | 'never';
}

export interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  gender: 'male' | 'female' | 'other';
  college: string;
  course?: string;
  academic_year?: string;
  target_move_in: string;
  budget_min: number;
  budget_max: number;
  preferred_areas: string[];
  lifestyle: StudentLifestyle;
  bio: string;
  phone_privacy: PhonePrivacy;
  phone_number?: string;
  is_demo?: boolean;
  compatibility_score?: number;
  compatibility_breakdown?: {
    factor: string;
    matched: boolean;
    description: string;
  }[];
}

export type PropertyType = 'room' | 'pg' | 'hostel' | 'flat' | 'homestay' | 'shared_room';
export type GenderPreference = 'male' | 'female' | 'any';
export type RoomType = 'single' | 'double' | 'triple' | 'four_plus';
export type AvailabilityStatus = 'available' | 'limited' | 'rented' | 'paused' | 'expired';

export interface PropertyAmenity {
  id: string;
  name: string;
  icon: string;
  included: boolean;
}

export interface PropertyRule {
  id: string;
  rule: string;
  allowed: boolean;
}

export interface PropertyImage {
  id: string;
  url: string;
  caption?: string;
  is_cover?: boolean;
}

export interface Property {
  id: string;
  owner_id: string; // Deprecated alias, backwards compatibility
  created_by?: string; // Authenticated user ID who created listing
  owner_name: string;
  lister_name?: string;
  owner_phone?: string | null; // Masked/omitted by repository if private
  lister_phone?: string | null;
  owner_avatar?: string;
  lister_avatar?: string;
  lister_type?: 'student' | 'owner' | 'individual'; // Informational metadata
  title: string;
  slug: string;
  description: string;
  property_type: PropertyType;
  gender_preference: GenderPreference;
  room_type: RoomType;
  rent: number;
  security_deposit: number;
  electricity_billing: 'included' | 'per_meter' | 'fixed_monthly';
  electricity_rate_per_unit?: number;
  maintenance_fee?: number;
  available_from: string;
  vacancies: number;
  floor?: number;
  total_floors?: number;
  furnishing_status: 'fully_furnished' | 'semi_furnished' | 'unfurnished';
  attached_bathroom: boolean;
  balcony: boolean;
  
  availability_status: AvailabilityStatus;
  is_verified: boolean;
  verification_badge?: 'mobile_verified' | 'platform_verified';
  is_featured: boolean;
  is_demo: boolean; // Flag identifying fictional seed records

  // Geographic coordinates (canonical server-side coordinates)
  // Geographic coordinates & Privacy controls
  country?: string; // Default: 'India'
  state: string; // e.g. 'Uttar Pradesh', 'Delhi', 'Maharashtra'
  state_code?: string; // e.g. 'UP', 'DL', 'MH', 'KA'
  city: string; // e.g. 'Prayagraj', 'Lucknow', 'New Delhi', 'Mumbai'
  city_slug?: string; // e.g. 'prayagraj', 'lucknow', 'new-delhi', 'mumbai'
  locality: string; // e.g. 'Katra', 'Gomti Nagar', 'Laxmi Nagar', 'Andheri'
  locality_slug?: string;
  sub_locality?: string;
  landmark?: string;
  pincode: string;
  address: string; // Sanitized to locality level for public; exact address revealed only on authorized share
  
  // Exact canonical coordinates (retained on backend; omitted/stripped in public responses)
  latitude?: number;
  longitude?: number;

  // Approximate presentation coordinates for public map (always fuzzed to neighborhood)
  display_latitude?: number;
  display_longitude?: number;

  amenities: string[];
  rules: string[];
  images: PropertyImage[];

  phone_privacy: PhonePrivacy;
  contact_request_status?: ContactRequestStatus;
  is_exact_location_shared?: boolean;
  exact_address_shared?: string | null;

  created_at: string;
  updated_at: string;

  // Runtime distance & scoring fields (computed by repository query)
  distance_km?: number;
  distance_formatted?: string;
  proximity_bucket?: ProximityBucket;
}

export type ProximityBucket = 'very_near' | 'nearby' | 'nearby_areas' | 'more_options';

export type LocationSource = 'gps' | 'search' | 'map' | 'manual' | 'none';

export interface LocationData {
  country: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  district?: string;
  city?: string;
  citySlug?: string;
  locality?: string;
  localitySlug?: string;
  subLocality?: string;
  landmark?: string;
  formattedAddress?: string;
  pincode?: string;

  latitude: number;
  longitude: number;

  accuracy?: number; // In meters
  isLowAccuracy?: boolean;
  accuracyLabel?: string;
  source?: LocationSource;
  placeId?: string;
}

export interface State {
  id: string;
  name: string;
  code: string; // e.g. 'UP', 'DL', 'MH', 'KA'
  slug: string;
  type?: 'state' | 'ut';
  capital?: string;
  region?: string;
}

export interface District {
  id: string;
  name: string;
  slug: string;
  state_code: string;
  state_name: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  state_code: string;
  state_name: string;
  district?: string;
  district_id?: string;
  latitude: number;
  longitude: number;
  is_popular?: boolean;
  image_url?: string;
  popular_for?: string;
  active_listings_count?: number;
}

export interface Locality {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  city_name: string;
  state_code: string;
  state_name: string;
  district?: string;
  district_id?: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  hindi_name?: string;
  landmark_highlight?: string;
  popular_for?: string;
  active_listings_count?: number;
  average_rent?: number;
  aliases?: string[];
}

export interface Landmark {
  id: string;
  name: string;
  short_name: string;
  category: 'university' | 'coaching_hub' | 'college' | 'transit' | 'tech_park' | 'landmark';
  city_slug: string;
  city_name: string;
  locality: string;
  latitude: number;
  longitude: number;
  radius_km_recommended?: number;
}

export interface LocalityInfo extends Locality {
  description?: string;
  image_url?: string;
}

export interface CollegeLandmark extends Landmark {}

export interface ContactRequest {
  id: string;
  property_id?: string;
  property_title?: string;
  requester_id: string;
  requester_name: string;
  requester_role?: string;
  requester_phone?: string;
  receiver_id: string;
  receiver_name: string;
  receiver_role?: string;
  receiver_phone?: string;
  status: ContactRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface ExactLocationShare {
  exact_address: string;
  landmark_directions?: string;
  google_maps_url: string;
  whatsapp_url?: string;
  shared_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  text: string;
  timestamp: string;
  is_read: boolean;
  property_context?: {
    id: string;
    title: string;
    locality: string;
    rent: number;
    image_url?: string;
  };
  location_share?: ExactLocationShare;
}

export interface Conversation {
  id: string;
  participant_ids: string[];
  participant_names: Record<string, string>;
  participant_avatars?: Record<string, string>;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  property_id?: string;
  property_title?: string;
  exact_location_share?: ExactLocationShare;
}

export interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_entity_type: 'property' | 'user';
  reported_entity_id: string;
  reported_entity_name: string;
  reason: 'fake_listing' | 'scam' | 'wrong_information' | 'harassment' | 'inappropriate_behaviour' | 'duplicate_listing' | 'property_unavailable' | 'other';
  notes?: string;
  status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  created_at: string;
}

export interface Review {
  id: string;
  property_id: string;
  student_id: string;
  student_name: string;
  student_avatar?: string;
  ratings: {
    cleanliness: number;
    safety: number;
    owner_behaviour: number;
    location: number;
    value: number;
  };
  overall_rating: number;
  comment: string;
  stay_duration: string;
  created_at: string;
  is_moderated: boolean;
}

export type UserLocationSource = LocationSource;

export interface UserLocationState {
  latitude?: number;
  longitude?: number;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  district?: string;
  city?: string;
  citySlug?: string;
  locality: string;
  localitySlug?: string;
  subLocality?: string;
  landmark?: string;
  displayName: string;
  formattedAddress?: string;
  source: UserLocationSource;
  accuracy?: number; // In meters
  isLowAccuracy?: boolean;
  accuracyLabel?: string;
  timestamp?: number;
  error?: string;
  isDetecting?: boolean;
}

export interface PropertySearchParams {
  country?: string;
  state?: string;
  city?: string;
  city_slug?: string;
  locality?: string;
  locality_slug?: string;
  query?: string;
  reference_lat?: number;
  reference_lng?: number;
  location_source?: UserLocationSource;
  property_type?: PropertyType | 'all';
  gender?: GenderPreference;
  room_type?: RoomType | 'all';
  min_price?: number;
  max_price?: number;
  amenities?: string[];
  verified_only?: boolean;
  sort_by?: 'nearest' | 'price_low' | 'price_high' | 'newest';
  radius_km?: number;
  strict_radius?: boolean;
}

export interface SearchResultSummary {
  properties: Property[];
  reference_locality: string;
  reference_city?: string;
  reference_state?: string;
  reference_coordinates: { latitude: number; longitude: number };
  total_found: number;
  exact_area_count: number;
  is_expanded: boolean;
  expanded_message?: string;
  buckets: {
    very_near: Property[];
    nearby: Property[];
    nearby_areas: Property[];
    more_options: Property[];
  };
}

export interface PendingAction {
  type: 'property-detail' | 'chat' | 'contact-request' | 'roommate-chat' | 'dashboard' | 'add-property' | 'saved';
  propertyId?: string;
  property?: Property;
  context?: {
    id: string;
    title: string;
    locality: string;
    rent: number;
    owner_id: string;
    owner_name: string;
  };
  subTab?: string;
}

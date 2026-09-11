export type UserRole = 'student' | 'owner' | 'admin';

export type PhonePrivacy = 'private' | 'on_request' | 'public';
export type ContactRequestStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  phone_number?: string;
  is_verified: boolean;
  is_blocked?: boolean;
  created_at: string;
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
  owner_id: string;
  owner_name: string;
  owner_phone?: string | null; // Masked/omitted by repository if private
  owner_avatar?: string;
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
  locality: string;
  sub_locality?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  latitude: number; // Exact canonical latitude
  longitude: number; // Exact canonical longitude

  // Presentation layer coordinates for public map (jittered)
  display_latitude?: number;
  display_longitude?: number;

  amenities: string[];
  rules: string[];
  images: PropertyImage[];

  phone_privacy: PhonePrivacy;
  contact_request_status?: ContactRequestStatus;

  created_at: string;
  updated_at: string;

  // Runtime distance & scoring fields (computed by repository query)
  distance_km?: number;
  distance_formatted?: string;
  proximity_bucket?: ProximityBucket;
}

export type ProximityBucket = 'very_near' | 'nearby' | 'nearby_areas' | 'more_options';

export interface LocalityInfo {
  id: string;
  name: string;
  hindi_name: string;
  latitude: number;
  longitude: number;
  description: string;
  popular_for: string;
  active_listings_count: number;
  average_rent: number;
  landmark_highlight: string;
  image_url: string;
}

export interface CollegeLandmark {
  id: string;
  name: string;
  short_name: string;
  category: 'university' | 'coaching_hub' | 'college' | 'transit';
  latitude: number;
  longitude: number;
  locality: string;
  radius_km_recommended: number;
}

export interface ContactRequest {
  id: string;
  property_id?: string;
  property_title?: string;
  requester_id: string;
  requester_name: string;
  requester_role: UserRole;
  requester_phone?: string;
  receiver_id: string;
  receiver_name: string;
  receiver_role: UserRole;
  receiver_phone?: string;
  status: ContactRequestStatus;
  created_at: string;
  updated_at: string;
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

export interface PropertySearchParams {
  locality?: string;
  reference_lat?: number;
  reference_lng?: number;
  property_type?: PropertyType | 'all';
  gender?: GenderPreference;
  room_type?: RoomType | 'all';
  min_price?: number;
  max_price?: number;
  amenities?: string[];
  verified_only?: boolean;
  sort_by?: 'nearest' | 'price_low' | 'price_high' | 'newest';
}

export interface SearchResultSummary {
  properties: Property[];
  reference_locality: string;
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

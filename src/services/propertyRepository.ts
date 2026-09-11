import { IPropertyRepository } from './contracts';
import {
  Property,
  PropertySearchParams,
  SearchResultSummary,
  ContactRequestStatus
} from '../types';
import { MOCK_PROPERTIES } from '../data/mockProperties';
import { PRAYAGRAJ_LOCALITIES } from '../config/localities';
import {
  calculateHaversineDistanceKm,
  formatDistance,
  getProximityBucket,
  getPublicDisplayCoordinates
} from '../utils/geo';

const STORAGE_KEY = 'prayag_living_properties_v1';

export class PropertyRepository implements IPropertyRepository {
  private getStoredProperties(): Property[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read properties from localStorage, using seed data:', e);
    }
    // Initialize storage with seed properties
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PROPERTIES));
    } catch (e) {
      // ignore
    }
    return [...MOCK_PROPERTIES];
  }

  private saveStoredProperties(properties: Property[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
    } catch (e) {
      console.error('Failed to save properties to localStorage:', e);
    }
  }

  /**
   * Helper to retrieve contact request status for the given property and requester.
   */
  private getContactRequestStatus(propertyId: string, userId?: string): ContactRequestStatus {
    if (!userId) return 'none';
    try {
      const stored = localStorage.getItem('prayag_living_contact_requests_v1');
      if (stored) {
        const requests = JSON.parse(stored);
        const req = requests.find(
          (r: any) => r.property_id === propertyId && r.requester_id === userId
        );
        if (req) return req.status;
      }
    } catch (e) {
      // ignore
    }
    return 'none';
  }

  /**
   * Enforces backend phone privacy rule:
   * Phone number is revealed ONLY when:
   *   phone_privacy === 'public' OR contact_request_status === 'accepted'
   * Otherwise, the raw phone is stripped/nullified before reaching presentation.
   */
  private applyPhonePrivacyEnforcement(property: Property, currentUserId?: string): Property {
    const cloned = { ...property };
    const requestStatus = this.getContactRequestStatus(cloned.id, currentUserId);
    cloned.contact_request_status = requestStatus;

    const isAuthorized =
      cloned.phone_privacy === 'public' ||
      requestStatus === 'accepted' ||
      (currentUserId && cloned.owner_id === currentUserId);

    if (!isAuthorized) {
      cloned.owner_phone = null;
    }

    // Attach public display coordinates (with privacy jitter) for map rendering
    const fuzzed = getPublicDisplayCoordinates(cloned.latitude, cloned.longitude, cloned.id);
    cloned.display_latitude = fuzzed.latitude;
    cloned.display_longitude = fuzzed.longitude;

    return cloned;
  }

  async searchProperties(
    params: PropertySearchParams,
    currentUserId?: string
  ): Promise<SearchResultSummary> {
    const all = this.getStoredProperties();

    // 1. Resolve reference coordinates
    let refLat = params.reference_lat;
    let refLng = params.reference_lng;
    let refLocalityName = params.locality || 'Katra';

    if (!refLat || !refLng) {
      const foundLocality = PRAYAGRAJ_LOCALITIES.find(
        (l) => l.name.toLowerCase() === (params.locality || 'katra').toLowerCase()
      );
      if (foundLocality) {
        refLat = foundLocality.latitude;
        refLng = foundLocality.longitude;
        refLocalityName = foundLocality.name;
      } else {
        // Default to Katra (center of student ecosystem)
        refLat = 25.4563;
        refLng = 81.8546;
        refLocalityName = 'Katra';
      }
    }

    // 2. Filter active properties based on query constraints (excluding rented/paused for search)
    let candidates = all.filter((p) => {
      // Hide rented or paused listings from search
      if (p.availability_status === 'rented' || p.availability_status === 'paused') {
        return false;
      }
      if (params.property_type && params.property_type !== 'all' && p.property_type !== params.property_type) {
        return false;
      }
      if (params.gender && params.gender !== 'any' && p.gender_preference !== 'any' && p.gender_preference !== params.gender) {
        return false;
      }
      if (params.room_type && params.room_type !== 'all' && p.room_type !== params.room_type) {
        return false;
      }
      if (params.min_price && p.rent < params.min_price) {
        return false;
      }
      if (params.max_price && p.rent > params.max_price) {
        return false;
      }
      if (params.verified_only && !p.is_verified) {
        return false;
      }
      if (params.amenities && params.amenities.length > 0) {
        const hasAll = params.amenities.every((a) => p.amenities.includes(a));
        if (!hasAll) return false;
      }
      return true;
    });

    // 3. Compute continuous distance and bucket for each property
    const scoredProperties = candidates.map((p) => {
      const dist = calculateHaversineDistanceKm(refLat!, refLng!, p.latitude, p.longitude);
      const bucket = getProximityBucket(dist);
      const secured = this.applyPhonePrivacyEnforcement(p, currentUserId);
      secured.distance_km = dist;
      secured.distance_formatted = formatDistance(dist);
      secured.proximity_bucket = bucket;
      return secured;
    });

    // 4. Proximity-Dominant Ranking (Anti-Leapfrogging Rule)
    // Primary: distance (ascending).
    // Tie-breaker within same close distance range (< 350m): featured status or verification.
    scoredProperties.sort((a, b) => {
      const distDiff = (a.distance_km || 0) - (b.distance_km || 0);
      // If distance difference is small (< 350m), featured or verified properties get a slight bump
      if (Math.abs(distDiff) <= 0.35) {
        const scoreA = (a.is_featured ? 2 : 0) + (a.is_verified ? 1 : 0);
        const scoreB = (b.is_featured ? 2 : 0) + (b.is_verified ? 1 : 0);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
      }
      return distDiff;
    });

    // Optional user secondary sorting
    if (params.sort_by === 'price_low') {
      scoredProperties.sort((a, b) => a.rent - b.rent);
    } else if (params.sort_by === 'price_high') {
      scoredProperties.sort((a, b) => b.rent - a.rent);
    } else if (params.sort_by === 'newest') {
      scoredProperties.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // 5. Partition into Presentation Buckets
    const buckets = {
      very_near: scoredProperties.filter((p) => p.proximity_bucket === 'very_near'),
      nearby: scoredProperties.filter((p) => p.proximity_bucket === 'nearby'),
      nearby_areas: scoredProperties.filter((p) => p.proximity_bucket === 'nearby_areas'),
      more_options: scoredProperties.filter((p) => p.proximity_bucket === 'more_options'),
    };

    const exactAreaCount = scoredProperties.filter(
      (p) => p.locality.toLowerCase() === refLocalityName.toLowerCase()
    ).length;

    // Continuous dynamic radius expansion message
    const isExpanded = exactAreaCount === 0 || exactAreaCount < 2;
    let expandedMessage: string | undefined;
    if (exactAreaCount === 0) {
      expandedMessage = `No exact matches right inside ${refLocalityName}. Showing ${scoredProperties.length} verified options starting from nearest areas nearby.`;
    } else if (exactAreaCount < 2) {
      expandedMessage = `Showing ${exactAreaCount} option in ${refLocalityName} plus ${scoredProperties.length - exactAreaCount} nearby options within close distance.`;
    }

    return {
      properties: scoredProperties,
      reference_locality: refLocalityName,
      reference_coordinates: { latitude: refLat!, longitude: refLng! },
      total_found: scoredProperties.length,
      exact_area_count: exactAreaCount,
      is_expanded: isExpanded,
      expanded_message: expandedMessage,
      buckets,
    };
  }

  async getPropertyById(id: string, currentUserId?: string): Promise<Property | null> {
    const all = this.getStoredProperties();
    const found = all.find((p) => p.id === id);
    if (!found) return null;
    return this.applyPhonePrivacyEnforcement(found, currentUserId);
  }

  async createProperty(data: Partial<Property>): Promise<Property> {
    const all = this.getStoredProperties();
    const newProperty: Property = {
      id: `prop-${Date.now()}`,
      owner_id: data.owner_id || 'owner-me',
      owner_name: data.owner_name || 'Property Owner',
      owner_phone: data.owner_phone || '+91 98765 43210',
      owner_avatar: data.owner_avatar,
      title: data.title || 'New Student Accommodation',
      slug: (data.title || 'property').toLowerCase().replace(/\s+/g, '-'),
      description: data.description || '',
      property_type: data.property_type || 'pg',
      gender_preference: data.gender_preference || 'any',
      room_type: data.room_type || 'single',
      rent: Number(data.rent) || 5000,
      security_deposit: Number(data.security_deposit) || 5000,
      electricity_billing: data.electricity_billing || 'included',
      electricity_rate_per_unit: data.electricity_rate_per_unit,
      maintenance_fee: Number(data.maintenance_fee) || 0,
      available_from: data.available_from || 'Immediately',
      vacancies: Number(data.vacancies) || 1,
      floor: Number(data.floor) || 1,
      total_floors: Number(data.total_floors) || 2,
      furnishing_status: data.furnishing_status || 'semi_furnished',
      attached_bathroom: Boolean(data.attached_bathroom),
      balcony: Boolean(data.balcony),
      availability_status: 'available',
      is_verified: false,
      is_featured: false,
      is_demo: false, // User-created listings are real local listings!
      locality: data.locality || 'Katra',
      sub_locality: data.sub_locality,
      landmark: data.landmark,
      city: 'Prayagraj',
      state: 'Uttar Pradesh',
      pincode: data.pincode || '211002',
      address: data.address || '',
      latitude: Number(data.latitude) || 25.4563,
      longitude: Number(data.longitude) || 81.8546,
      amenities: data.amenities || ['wifi', 'ro_water', 'study_table'],
      rules: data.rules || ['quiet_hours'],
      images: data.images && data.images.length > 0 ? data.images : [
        {
          id: 'img-default',
          url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80',
          is_cover: true,
          caption: 'Room overview'
        }
      ],
      phone_privacy: data.phone_privacy || 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    all.unshift(newProperty);
    this.saveStoredProperties(all);
    return newProperty;
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<Property> {
    const all = this.getStoredProperties();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) throw new Error(`Property ${id} not found`);

    const updated = {
      ...all[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    all[index] = updated;
    this.saveStoredProperties(all);
    return updated;
  }

  async getPropertiesByOwner(ownerId: string): Promise<Property[]> {
    const all = this.getStoredProperties();
    return all.filter((p) => p.owner_id === ownerId);
  }

  async getAllPropertiesAdmin(): Promise<Property[]> {
    return this.getStoredProperties();
  }

  async updatePropertyStatus(
    id: string,
    status: Property['availability_status']
  ): Promise<Property> {
    return this.updateProperty(id, { availability_status: status });
  }

  async verifyProperty(
    id: string,
    badge: Property['verification_badge'] = 'platform_verified'
  ): Promise<Property> {
    return this.updateProperty(id, {
      is_verified: true,
      verification_badge: badge,
    });
  }
}

export const propertyRepository = new PropertyRepository();

import { IPropertyRepository } from './contracts';
import {
  Property,
  PropertySearchParams,
  SearchResultSummary,
  ContactRequestStatus
} from '../types';
import { MOCK_PROPERTIES } from '../data/mockProperties';
import { locationRepository } from './locationRepository';
import {
  calculateHaversineDistanceKm,
  formatDistance,
  getProximityBucket,
  getPublicDisplayCoordinates
} from '../utils/geo';
import { serverAuth } from './serverAuth';

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
   * Helper to check if owner has shared exact location with this user in chat.
   */
  private hasSharedExactLocation(propertyId: string, userId?: string): boolean {
    if (!userId) return false;
    try {
      const stored = localStorage.getItem('prayag_living_conversations_v1');
      if (stored) {
        const convs = JSON.parse(stored);
        const match = convs.find(
          (c: any) =>
            c.property_id === propertyId &&
            c.participant_ids.includes(userId) &&
            Boolean(c.exact_location_share)
        );
        if (match) return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  /**
   * Enforces backend privacy rules:
   * 1. PHONE PRIVACY: Phone number is revealed ONLY when:
   *    phone_privacy === 'public' OR contact_request_status === 'accepted' OR user is owner
   * 2. LOCATION PRIVACY: Canonical coordinates & exact house addresses are NEVER
   *    exposed to public users. Public map only receives display_latitude / display_longitude
   *    (neighborhood jitter). Exact address is only shared when explicitly sent by owner in chat.
   */
  private applyPrivacyEnforcement(property: Property, currentUserId?: string): Property {
    const cloned = { ...property };
    const requestStatus = this.getContactRequestStatus(cloned.id, currentUserId);
    cloned.contact_request_status = requestStatus;

    const isOwnerOrAdmin = Boolean(
      currentUserId && (cloned.owner_id === currentUserId || currentUserId === 'admin-1')
    );

    const isLocationShared = this.hasSharedExactLocation(cloned.id, currentUserId);
    cloned.is_exact_location_shared = isLocationShared;

    // 1. Phone Privacy
    const isPhoneAuthorized =
      cloned.phone_privacy === 'public' ||
      requestStatus === 'accepted' ||
      isOwnerOrAdmin;

    if (!isPhoneAuthorized) {
      cloned.owner_phone = null;
    }

    // 2. Approximate Presentation Coordinates (Neighborhood jitter)
    // Always compute fuzzed coordinates based on canonical coordinates
    const canonicalLat = property.latitude || 25.4563;
    const canonicalLng = property.longitude || 81.8546;
    const fuzzed = getPublicDisplayCoordinates(canonicalLat, canonicalLng, cloned.id);
    cloned.display_latitude = fuzzed.latitude;
    cloned.display_longitude = fuzzed.longitude;

    // 3. Coordinate & Address Sanitization for Public Clients
    if (!isOwnerOrAdmin) {
      // Stripped at repository layer: public clients NEVER receive canonical latitude/longitude
      delete (cloned as any).latitude;
      delete (cloned as any).longitude;

      // Always sanitize public address to locality level (e.g. "Katra, Prayagraj", "Gomti Nagar, Lucknow")
      // The exact doorstep address is strictly confined to the authenticated chat conversation
      cloned.address = `${cloned.locality}, ${cloned.city || 'India'}`;
      cloned.exact_address_shared = null;
    } else {
      // Owner/admin keeps full canonical access for maintenance & verification
      cloned.exact_address_shared = property.address;
    }

    return cloned;
  }

  async searchProperties(
    params: PropertySearchParams,
    currentUserId?: string
  ): Promise<SearchResultSummary> {
    const all = this.getStoredProperties();

    // 1. Resolve reference coordinates and geographic context
    let refLat = params.reference_lat;
    let refLng = params.reference_lng;
    let refLocalityName = params.locality || '';
    let refCity = params.city;
    let refState = params.state;

    // A. If coordinates are provided (e.g. from GPS or map click):
    if (refLat && refLng) {
      if (!refLocalityName || !refCity) {
        const rev = locationRepository.reverseGeocode(refLat, refLng);
        if (!refLocalityName) refLocalityName = rev.localityName;
        if (!refCity) refCity = rev.cityName;
        if (!refState) refState = rev.stateName;
      }
    } else if (params.locality) {
      // B. Locality lookup
      const foundLoc = locationRepository.getLocalityBySlugOrName(params.locality, params.city);
      if (foundLoc) {
        refLat = foundLoc.latitude;
        refLng = foundLoc.longitude;
        refLocalityName = foundLoc.name;
        if (!refCity) refCity = foundLoc.city_name;
        if (!refState) refState = foundLoc.state_name;
      } else {
        // Check if locality query was actually a city name!
        const foundCity = locationRepository.getCityBySlugOrName(params.locality);
        if (foundCity) {
          refLat = foundCity.latitude;
          refLng = foundCity.longitude;
          refLocalityName = foundCity.name;
          refCity = foundCity.name;
          refState = foundCity.state_name;
        }
      }
    } else if (params.city) {
      // C. City lookup
      const foundCity = locationRepository.getCityBySlugOrName(params.city);
      if (foundCity) {
        refLat = foundCity.latitude;
        refLng = foundCity.longitude;
        refLocalityName = foundCity.name;
        refCity = foundCity.name;
        refState = foundCity.state_name;
      }
    } else if (params.query) {
      // D. Omnibox search query lookup
      const matches = locationRepository.searchLocations(params.query);
      if (matches.length > 0) {
        const best = matches[0];
        refLat = best.latitude;
        refLng = best.longitude;
        refLocalityName = best.locality || best.city;
        refCity = best.city;
        refState = best.state;
      }
    }

    // Default fallback if still unresolved
    if (!refLat || !refLng) {
      if (refCity) {
        const foundCity = locationRepository.getCityBySlugOrName(refCity);
        if (foundCity) {
          refLat = foundCity.latitude;
          refLng = foundCity.longitude;
          refLocalityName = refLocalityName || foundCity.name;
          refState = refState || foundCity.state_name;
        }
      }
      if (!refLat || !refLng) {
        // Center of India geographic centroid
        refLat = 20.5937;
        refLng = 78.9629;
        refLocalityName = refLocalityName || 'All Locations';
        refCity = refCity || 'All India';
        refState = refState || 'India';
      }
    }

    // 2. Filter active properties based on query constraints (excluding rented/paused for search)
    let candidates = all.filter((p) => {
      // Hide rented or paused listings from search
      if (p.availability_status === 'rented' || p.availability_status === 'paused') {
        return false;
      }

      // Explicit city filter (when user actively selects a city in filters)
      const explicitCity = params.city && params.city !== 'all' ? params.city : undefined;
      if (explicitCity) {
        const cityMatch =
          (p.city_slug && p.city_slug.toLowerCase() === explicitCity.toLowerCase()) ||
          p.city.toLowerCase() === explicitCity.toLowerCase();
        if (!cityMatch) return false;
      }

      // Explicit state filter (if specified)
      const explicitState = params.state && params.state !== 'all' ? params.state : undefined;
      if (explicitState) {
        const stateMatch =
          (p.state_code && p.state_code.toLowerCase() === explicitState.toLowerCase()) ||
          p.state.toLowerCase() === explicitState.toLowerCase();
        if (!stateMatch) return false;
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
      const canonicalLat = p.latitude
        ?? locationRepository.getCityBySlugOrName(p.city_slug || p.city)?.latitude
        ?? 20.5937;
      const canonicalLng = p.longitude
        ?? locationRepository.getCityBySlugOrName(p.city_slug || p.city)?.longitude
        ?? 78.9629;
      const dist = calculateHaversineDistanceKm(refLat!, refLng!, canonicalLat, canonicalLng);
      const bucket = getProximityBucket(dist);
      const secured = this.applyPrivacyEnforcement(p, currentUserId);
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
    if (scoredProperties.length === 0) {
      expandedMessage = `No rooms currently listed in ${refLocalityName || 'this location'}. Be the first to list one!`;
    } else if (exactAreaCount === 0) {
      expandedMessage = `No exact matches right inside ${refLocalityName}. Showing ${scoredProperties.length} verified options starting from nearest areas nearby.`;
    } else if (exactAreaCount < 2) {
      expandedMessage = `Showing ${exactAreaCount} option in ${refLocalityName} plus ${scoredProperties.length - exactAreaCount} nearby options within close distance.`;
    }

    return {
      properties: scoredProperties,
      reference_locality: refLocalityName,
      reference_city: refCity,
      reference_state: refState,
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
    const prop = all.find((p) => p.id === id);
    if (!prop) return null;
    return this.applyPrivacyEnforcement(prop, currentUserId);
  }

  async createProperty(
    data: Partial<Property>,
    authenticatedUserId?: string
  ): Promise<Property> {
    const all = this.getStoredProperties();
    const id = `prop-${Date.now()}`;
    const slug = (data.title || 'student-room')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const creatorId = authenticatedUserId || data.created_by || data.owner_id || 'user-default';

    const newProperty: Property = {
      id,
      owner_id: creatorId,
      created_by: creatorId,
      owner_name: data.lister_name || data.owner_name || 'Member',
      lister_name: data.lister_name || data.owner_name || 'Member',
      owner_phone: data.owner_phone || null,
      lister_phone: data.owner_phone || null,
      lister_type: data.lister_type || 'individual',
      title: data.title || 'Student Room',
      slug,
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
      verification_badge: undefined,
      is_featured: false,
      is_demo: false, // User-created listings are real local listings!
      country: data.country || 'India',
      state: data.state || '',
      state_code: data.state_code || '',
      city: data.city || '',
      city_slug: data.city_slug || (data.city ? data.city.toLowerCase().replace(/\s+/g, '-') : ''),
      locality: data.locality || '',
      locality_slug: data.locality_slug || (data.locality ? data.locality.toLowerCase().replace(/\s+/g, '-') : ''),
      sub_locality: data.sub_locality,
      landmark: data.landmark,
      pincode: data.pincode || '',
      address: data.address || '',
      latitude: (() => {
        if (data.latitude && !isNaN(Number(data.latitude))) return Number(data.latitude);
        const loc = locationRepository.getLocalityBySlugOrName(data.locality || '', data.city);
        if (loc) return loc.latitude;
        const ct = locationRepository.getCityBySlugOrName(data.city || '');
        if (ct) return ct.latitude;
        return 20.5937;
      })(),
      longitude: (() => {
        if (data.longitude && !isNaN(Number(data.longitude))) return Number(data.longitude);
        const loc = locationRepository.getLocalityBySlugOrName(data.locality || '', data.city);
        if (loc) return loc.longitude;
        const ct = locationRepository.getCityBySlugOrName(data.city || '');
        if (ct) return ct.longitude;
        return 78.9629;
      })(),
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

  async updateProperty(
    id: string,
    updates: Partial<Property>,
    requestingUserId?: string
  ): Promise<Property> {
    const all = this.getStoredProperties();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) throw new Error(`Property ${id} not found`);

    if (requestingUserId) {
      const isOwner = all[index].created_by === requestingUserId || all[index].owner_id === requestingUserId;
      const isAdmin = await serverAuth.verifySuperAdminAuthorization(requestingUserId);
      if (!isOwner && !isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to modify this listing');
      }
    }

    const updated = {
      ...all[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    all[index] = updated;
    this.saveStoredProperties(all);
    return updated;
  }

  async deleteProperty(id: string, requestingUserId?: string): Promise<boolean> {
    const all = this.getStoredProperties();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) return false;

    if (requestingUserId) {
      const isOwner = all[index].created_by === requestingUserId || all[index].owner_id === requestingUserId;
      const isAdmin = await serverAuth.verifySuperAdminAuthorization(requestingUserId);
      if (!isOwner && !isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to delete this listing');
      }
    }

    all.splice(index, 1);
    this.saveStoredProperties(all);
    return true;
  }

  async getPropertiesByOwner(ownerId: string): Promise<Property[]> {
    const all = this.getStoredProperties();
    return all.filter((p) => p.owner_id === ownerId || p.created_by === ownerId);
  }

  async getAllPropertiesAdmin(adminUserId?: string): Promise<Property[]> {
    await serverAuth.assertSuperAdmin(adminUserId);
    return this.getStoredProperties();
  }

  async updatePropertyStatus(
    id: string,
    status: Property['availability_status'],
    requestingUserId?: string
  ): Promise<Property> {
    return this.updateProperty(id, { availability_status: status }, requestingUserId);
  }

  async verifyProperty(
    id: string,
    badge: Property['verification_badge'] = 'platform_verified',
    adminUserId?: string
  ): Promise<Property> {
    await serverAuth.assertSuperAdmin(adminUserId);
    return this.updateProperty(id, {
      is_verified: true,
      verification_badge: badge,
    });
  }
}

export const propertyRepository = new PropertyRepository();

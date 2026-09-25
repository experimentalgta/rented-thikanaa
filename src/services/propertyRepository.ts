import { IPropertyRepository } from './contracts';
import {
  Property,
  PropertySearchParams,
  SearchResultSummary,
  ContactRequestStatus,
  PropertyImage
} from '../types';
import { locationRepository } from './locationRepository';
import {
  calculateHaversineDistanceKm,
  formatDistance,
  getProximityBucket,
  getPublicDisplayCoordinates
} from '../utils/geo';
import { serverAuth } from './serverAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const DEFAULT_SEARCH_RADIUS_KM = 5;

export class PropertyRepository implements IPropertyRepository {
  private assertSupabaseClient() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase is not configured. Please verify that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
      );
    }
    return supabase;
  }

  /**
   * Helper to retrieve contact request status for the given property and requester.
   */
  private async getContactRequestStatus(propertyId: string, userId?: string): Promise<ContactRequestStatus> {
    if (!userId || !supabase) return 'none';
    try {
      const { data, error } = await supabase
        .from('contact_requests')
        .select('status')
        .eq('property_id', propertyId)
        .eq('requester_id', userId)
        .maybeSingle();

      if (error || !data) return 'none';
      return data.status as ContactRequestStatus;
    } catch {
      return 'none';
    }
  }

  /**
   * Helper to check if owner has shared exact location with this user in chat.
   */
  private async hasSharedExactLocation(propertyId: string, userId?: string): Promise<boolean> {
    if (!userId || !supabase) return false;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('property_id', propertyId)
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
        .maybeSingle();

      return Boolean(data && !error);
    } catch {
      return false;
    }
  }

  /**
   * Enforces backend privacy rules:
   * 1. PHONE PRIVACY: Phone number is revealed ONLY when:
   *    phone_privacy === 'public' OR contact_request_status === 'accepted' OR user is owner/admin
   * 2. LOCATION PRIVACY: Canonical coordinates & exact house addresses are NEVER
   *    exposed to public users. Public map only receives display_latitude / display_longitude
   *    (neighborhood jitter). Exact address is only shared when explicitly sent by owner in chat.
   */
  private async applyPrivacyEnforcement(
    property: Property,
    currentUserId?: string,
    preloadedContactStatus?: ContactRequestStatus
  ): Promise<Property> {
    const cloned = { ...property };
    const requestStatus =
      preloadedContactStatus !== undefined
        ? preloadedContactStatus
        : await this.getContactRequestStatus(cloned.id, currentUserId);

    cloned.contact_request_status = requestStatus;

    const isOwnerOrAdmin = Boolean(
      currentUserId &&
        (cloned.owner_id === currentUserId ||
          cloned.created_by === currentUserId ||
          serverAuth.isSuperAdmin(currentUserId))
    );

    const isLocationShared = await this.hasSharedExactLocation(cloned.id, currentUserId);
    cloned.is_exact_location_shared = isLocationShared;

    // 1. Phone Privacy
    const isPhoneAuthorized =
      cloned.phone_privacy === 'public' ||
      requestStatus === 'accepted' ||
      isOwnerOrAdmin;

    if (!isPhoneAuthorized) {
      cloned.owner_phone = null;
      cloned.lister_phone = null;
    }

    // 2. Approximate Presentation Coordinates (Neighborhood jitter)
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
      cloned.address = `${cloned.locality}, ${cloned.city || 'India'}`;
      cloned.exact_address_shared = null;
    } else {
      // Owner/admin keeps full canonical access for maintenance & verification
      cloned.exact_address_shared = property.address;
    }

    return cloned;
  }

  /**
   * Maps a database row (from get_properties_proximity_ranked or table select) to Property model.
   */
  private mapRowToProperty(row: any): Property {
    let images: PropertyImage[] = [];
    if (Array.isArray(row.images)) {
      images = row.images;
    } else if (Array.isArray(row.property_images)) {
      images = row.property_images.map((pi: any) => ({
        id: pi.id,
        url: pi.url,
        caption: pi.caption,
        is_cover: pi.is_cover,
      }));
    }

    if (images.length === 0) {
      images = [
        {
          id: 'img-default',
          url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80',
          is_cover: true,
          caption: 'Property overview',
        },
      ];
    }

    // Extract coordinates
    let lat: number | undefined = row.latitude;
    let lon: number | undefined = row.longitude;
    if (lat === undefined && row.location && row.location.coordinates) {
      lon = row.location.coordinates[0];
      lat = row.location.coordinates[1];
    }

    return {
      id: row.id,
      owner_id: row.owner_id,
      created_by: row.created_by || row.owner_id,
      owner_name: row.owner?.full_name || row.owner_name || 'Host / Owner',
      lister_name: row.owner?.full_name || row.owner_name || 'Host / Owner',
      owner_phone: row.owner?.phone_number || row.phone_number || null,
      lister_phone: row.owner?.phone_number || row.phone_number || null,
      owner_avatar: row.owner?.avatar_url || undefined,
      lister_avatar: row.owner?.avatar_url || undefined,
      lister_type: row.lister_type || 'individual',
      title: row.title,
      slug: row.slug,
      description: row.description || '',
      property_type: row.property_type,
      gender_preference: row.gender_preference,
      room_type: row.room_type,
      rent: Number(row.rent) || 0,
      security_deposit: Number(row.security_deposit) || 0,
      electricity_billing: row.electricity_billing || 'included',
      electricity_rate_per_unit: row.electricity_rate_per_unit,
      maintenance_fee: Number(row.maintenance_fee) || 0,
      available_from: row.available_from || 'Immediately',
      vacancies: Number(row.vacancies) || 1,
      floor: row.floor,
      total_floors: row.total_floors,
      furnishing_status: row.furnishing_status || 'semi_furnished',
      attached_bathroom: Boolean(row.attached_bathroom),
      balcony: Boolean(row.balcony),
      availability_status: row.availability_status || 'available',
      is_verified: Boolean(row.is_verified),
      verification_badge: row.verification_badge || undefined,
      is_featured: Boolean(row.is_featured),
      is_demo: Boolean(row.is_demo),
      country: 'India',
      state: row.state,
      city: row.city,
      city_slug: row.city?.toLowerCase().replace(/\s+/g, '-'),
      locality: row.locality,
      locality_slug: row.locality?.toLowerCase().replace(/\s+/g, '-'),
      sub_locality: row.sub_locality,
      landmark: row.landmark,
      pincode: row.pincode || '',
      address: row.address || `${row.locality}, ${row.city}`,
      latitude: lat ? Number(lat) : 25.4563,
      longitude: lon ? Number(lon) : 81.8546,
      amenities: row.amenities || [],
      rules: row.rules || [],
      images,
      phone_privacy: row.phone_privacy || 'private',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  }

  async searchProperties(
    params: PropertySearchParams,
    currentUserId?: string
  ): Promise<SearchResultSummary> {
    const client = this.assertSupabaseClient();

    // 1. Resolve reference coordinates and geographic context
    let refLat = params.reference_lat;
    let refLng = params.reference_lng;
    let refLocalityName = params.locality || '';
    let refCity = params.city;
    let refState = params.state;

    // A. Coordinates provided (GPS or map click)
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

    // Default fallback coordinates if unresolved (Prayagraj default)
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
        refLat = 25.4563;
        refLng = 81.8546;
        refLocalityName = refLocalityName || 'Prayagraj';
        refCity = refCity || 'Prayagraj';
        refState = refState || 'Uttar Pradesh';
      }
    }

    // 2. Query Supabase via PostGIS Proximity Function
    const { data: rpcRows, error: rpcError } = await client.rpc(
      'get_properties_proximity_ranked',
      {
        ref_lat: refLat,
        ref_lon: refLng,
        filter_gender: params.gender && params.gender !== 'any' ? params.gender : null,
        filter_prop_type: params.property_type && params.property_type !== 'all' ? params.property_type : null,
        filter_max_rent: params.max_price || null,
        filter_city: params.city && params.city !== 'all' ? params.city : null,
      }
    );

    let rawListings: any[] = [];

    if (!rpcError && Array.isArray(rpcRows)) {
      rawListings = rpcRows;
    } else {
      // Fallback to direct table query if RPC is unavailable
      let query = client
        .from('properties')
        .select(`
          *,
          property_images (id, url, caption, is_cover, sort_order)
        `)
        .in('availability_status', ['available', 'limited']);

      if (params.city && params.city !== 'all') {
        query = query.ilike('city', `%${params.city}%`);
      }
      if (params.property_type && params.property_type !== 'all') {
        query = query.eq('property_type', params.property_type);
      }
      if (params.gender && params.gender !== 'any') {
        query = query.or(`gender_preference.eq.any,gender_preference.eq.${params.gender}`);
      }
      if (params.max_price) {
        query = query.lte('rent', params.max_price);
      }

      const { data: tableRows, error: tableError } = await query;
      if (tableError) {
        throw new Error(`Failed to retrieve properties from Supabase: ${tableError.message}`);
      }
      rawListings = tableRows || [];
    }

    // 3. Map rows and calculate geodesic distances
    const scoredProperties: Property[] = [];

    for (const row of rawListings) {
      const prop = this.mapRowToProperty(row);

      // Distance computation
      let distanceKm: number;
      if (row.distance_meters !== undefined && row.distance_meters !== null) {
        distanceKm = Math.round((Number(row.distance_meters) / 1000) * 100) / 100;
      } else {
        const propLat = prop.latitude || 25.4563;
        const propLng = prop.longitude || 81.8546;
        distanceKm = calculateHaversineDistanceKm(refLat, refLng, propLat, propLng);
      }

      prop.distance_km = distanceKm;
      prop.distance_formatted = formatDistance(distanceKm);
      prop.proximity_bucket = getProximityBucket(distanceKm);

      // Filter by min price if specified
      if (params.min_price && prop.rent < params.min_price) {
        continue;
      }

      // Filter by verified only if requested
      if (params.verified_only && !prop.is_verified) {
        continue;
      }

      // Filter by room type if requested
      if (params.room_type && params.room_type !== 'all' && prop.room_type !== params.room_type) {
        continue;
      }

      // Filter by amenities if requested
      if (params.amenities && params.amenities.length > 0) {
        const hasAllAmenities = params.amenities.every((a) => prop.amenities?.includes(a));
        if (!hasAllAmenities) continue;
      }

      // Filter by search radius (km) if specified
      if (params.radius_km && params.radius_km > 0) {
        const hasCoordinates = (row.latitude !== null && row.latitude !== undefined) || (row.distance_meters !== null && row.distance_meters !== undefined);
        if (hasCoordinates) {
          if (distanceKm > params.radius_km) {
            continue;
          }
        } else {
          // Compatibility fallback: if listing lacks coordinates, check city or locality match
          const cityMatches = !refCity || !prop.city || prop.city.toLowerCase() === refCity.toLowerCase();
          const localityMatches = !refLocalityName || !prop.locality ||
            prop.locality.toLowerCase().includes(refLocalityName.toLowerCase()) ||
            refLocalityName.toLowerCase().includes(prop.locality.toLowerCase());
          if (!cityMatches && !localityMatches) {
            continue;
          }
        }
      }

      // Privacy enforcement
      const sanitized = await this.applyPrivacyEnforcement(prop, currentUserId);
      scoredProperties.push(sanitized);
    }

    // 4. Sort properties
    const sortBy = params.sort_by || 'nearest';
    if (sortBy === 'price_low') {
      scoredProperties.sort((a, b) => a.rent - b.rent);
    } else if (sortBy === 'price_high') {
      scoredProperties.sort((a, b) => b.rent - a.rent);
    } else if (sortBy === 'newest') {
      scoredProperties.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      // Nearest default
      scoredProperties.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
    }

    // 5. Partition into anti-leapfrogging proximity buckets
    const buckets = {
      very_near: scoredProperties.filter((p) => p.proximity_bucket === 'very_near'),
      nearby: scoredProperties.filter((p) => p.proximity_bucket === 'nearby'),
      nearby_areas: scoredProperties.filter((p) => p.proximity_bucket === 'nearby_areas'),
      more_options: scoredProperties.filter((p) => p.proximity_bucket === 'more_options'),
    };

    const exactAreaCount = buckets.very_near.length;
    const isExpanded = exactAreaCount === 0 && scoredProperties.length > 0;
    let expandedMessage: string | undefined;

    if (isExpanded) {
      const nearestDist = scoredProperties[0]?.distance_formatted || 'nearby';
      expandedMessage = `No active listings right inside ${refLocalityName}. Showing the closest options starting ${nearestDist}.`;
    }

    return {
      properties: scoredProperties,
      reference_locality: refLocalityName,
      reference_coordinates: { latitude: refLat, longitude: refLng },
      total_found: scoredProperties.length,
      exact_area_count: exactAreaCount,
      is_expanded: isExpanded,
      expanded_message: expandedMessage,
      buckets,
    };
  }

  async getPropertyById(id: string, currentUserId?: string): Promise<Property | null> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('properties')
      .select(`
        *,
        property_images (id, url, caption, is_cover, sort_order),
        owner:profiles!properties_owner_id_fkey (id, full_name, avatar_url, phone_number)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch property from Supabase: ${error.message}`);
    }
    if (!data) return null;

    const prop = this.mapRowToProperty(data);
    return this.applyPrivacyEnforcement(prop, currentUserId);
  }

  async createProperty(data: Partial<Property>): Promise<Property> {
    const client = this.assertSupabaseClient();

    const lat = data.latitude || 25.4563;
    const lon = data.longitude || 81.8546;

    const insertData: any = {
      title: data.title,
      slug:
        data.slug ||
        (data.title
          ? data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4)
          : 'listing-' + Date.now()),
      description: data.description || '',
      property_type: data.property_type || 'pg',
      gender_preference: data.gender_preference || 'any',
      room_type: data.room_type || 'single',
      rent: Number(data.rent) || 5000,
      security_deposit: Number(data.security_deposit) || 0,
      electricity_billing: data.electricity_billing || 'included',
      maintenance_fee: Number(data.maintenance_fee) || 0,
      available_from: data.available_from || 'Immediately',
      vacancies: Number(data.vacancies) || 1,
      floor: Number(data.floor) || 1,
      total_floors: Number(data.total_floors) || 2,
      furnishing_status: data.furnishing_status || 'semi_furnished',
      attached_bathroom: Boolean(data.attached_bathroom),
      balcony: Boolean(data.balcony),
      availability_status: 'available',
      locality: data.locality || '',
      sub_locality: data.sub_locality || null,
      landmark: data.landmark || null,
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      address: data.address || '',
      location: `POINT(${lon} ${lat})`,
      amenities: data.amenities || [],
      rules: data.rules || [],
      phone_privacy: data.phone_privacy || 'private',
      is_demo: false,
    };

    if (data.owner_id) {
      insertData.owner_id = data.owner_id;
      insertData.created_by = data.created_by || data.owner_id;
    }

    const { data: created, error } = await client
      .from('properties')
      .insert(insertData)
      .select(`
        *,
        property_images (id, url, caption, is_cover, sort_order)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create property in Supabase: ${error.message}`);
    }

    // Insert images if provided
    if (data.images && data.images.length > 0) {
      const imageInserts = data.images.map((img, idx) => ({
        property_id: created.id,
        url: img.url,
        caption: img.caption || '',
        is_cover: Boolean(img.is_cover || idx === 0),
        sort_order: idx,
      }));

      await client.from('property_images').insert(imageInserts);
    }

    return this.mapRowToProperty(created);
  }

  async updateProperty(
    id: string,
    updates: Partial<Property>,
    requestingUserId?: string
  ): Promise<Property> {
    const client = this.assertSupabaseClient();

    if (requestingUserId) {
      const current = await this.getPropertyById(id, requestingUserId);
      if (!current) throw new Error(`Property ${id} not found`);

      const isOwner = current.owner_id === requestingUserId || current.created_by === requestingUserId;
      const isAdmin = serverAuth.isSuperAdmin(requestingUserId);
      if (!isOwner && !isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to modify this listing');
      }
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.rent !== undefined) updatePayload.rent = Number(updates.rent);
    if (updates.availability_status !== undefined) updatePayload.availability_status = updates.availability_status;
    if (updates.is_verified !== undefined) updatePayload.is_verified = Boolean(updates.is_verified);
    if (updates.verification_badge !== undefined) updatePayload.verification_badge = updates.verification_badge;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.amenities !== undefined) updatePayload.amenities = updates.amenities;
    if (updates.rules !== undefined) updatePayload.rules = updates.rules;
    if (updates.phone_privacy !== undefined) updatePayload.phone_privacy = updates.phone_privacy;

    const { data, error } = await client
      .from('properties')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        property_images (id, url, caption, is_cover, sort_order)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update property in Supabase: ${error.message}`);
    }

    return this.mapRowToProperty(data);
  }

  async deleteProperty(id: string, requestingUserId?: string): Promise<boolean> {
    const client = this.assertSupabaseClient();

    if (requestingUserId) {
      const current = await this.getPropertyById(id, requestingUserId);
      if (!current) return false;

      const isOwner = current.owner_id === requestingUserId || current.created_by === requestingUserId;
      const isAdmin = serverAuth.isSuperAdmin(requestingUserId);
      if (!isOwner && !isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to delete this listing');
      }
    }

    const { error } = await client.from('properties').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete property from Supabase: ${error.message}`);
    }
    return true;
  }

  async getPropertiesByOwner(ownerId: string): Promise<Property[]> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('properties')
      .select(`
        *,
        property_images (id, url, caption, is_cover, sort_order)
      `)
      .or(`owner_id.eq.${ownerId},created_by.eq.${ownerId}`);

    if (error) {
      throw new Error(`Failed to fetch owner properties from Supabase: ${error.message}`);
    }

    const properties: Property[] = [];
    for (const row of data || []) {
      const prop = this.mapRowToProperty(row);
      properties.push(await this.applyPrivacyEnforcement(prop, ownerId));
    }
    return properties;
  }

  async getAllPropertiesAdmin(adminUserId?: string): Promise<Property[]> {
    await serverAuth.assertSuperAdmin(adminUserId);
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('properties')
      .select(`
        *,
        property_images (id, url, caption, is_cover, sort_order)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch admin properties from Supabase: ${error.message}`);
    }

    const properties: Property[] = [];
    for (const row of data || []) {
      const prop = this.mapRowToProperty(row);
      properties.push(await this.applyPrivacyEnforcement(prop, adminUserId));
    }
    return properties;
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
    return this.updateProperty(
      id,
      {
        is_verified: true,
        verification_badge: badge,
      },
      adminUserId
    );
  }
}

export const propertyRepository = new PropertyRepository();

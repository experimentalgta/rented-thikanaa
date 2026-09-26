import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Property, PropertySearchParams, SearchResultSummary } from '../types';
import { propertyRepository, DEFAULT_SEARCH_RADIUS_KM } from '../services/propertyRepository';
import { calculateHaversineDistanceKm, getProximityBucket, formatDistance } from '../utils/geo';
import { useLocation } from './LocationContext';
import { useAuth } from './AuthContext';

export interface NearbyRoomsCache {
  summary: SearchResultSummary;
  rawProperties: Property[];
  latitude: number;
  longitude: number;
  city: string;
  locality: string;
  fetchedAt: number;
}

export interface NearbyRoomsContextType {
  cachedSummary: SearchResultSummary | null;
  rawProperties: Property[];
  isLoadingRooms: boolean;
  roomsError: string | null;
  cacheTimestamp: number | null;
  cachedLocation: { lat: number; lng: number; locality: string; city: string } | null;
  fetchNearbyRooms: (options?: {
    force?: boolean;
    lat?: number;
    lng?: number;
    city?: string;
    locality?: string;
    radius_km?: number;
  }) => Promise<SearchResultSummary | null>;
  refreshNearbyRooms: (options?: { forceGps?: boolean }) => Promise<SearchResultSummary | null>;
  getFilteredRooms: (
    filters: PropertySearchParams,
    searchRadiusKm?: number
  ) => SearchResultSummary | null;
  invalidateCache: () => void;
}

const NearbyRoomsContext = createContext<NearbyRoomsContextType | undefined>(undefined);

const LOCATION_CHANGE_THRESHOLD_KM = 1.5;
const NEARBY_ROOMS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const SESSION_CACHE_KEY = 'rented_thikan_nearby_rooms_cache_v1';

/**
 * High-performance client-side filtering and bucketing over cached properties.
 * Executes synchronously in pure memory in < 1ms without any network or GPS overhead.
 */
function filterAndBucketProperties(
  properties: Property[],
  refLat: number,
  refLng: number,
  refLocality: string,
  refCity: string,
  filters: PropertySearchParams,
  radiusKm: number = DEFAULT_SEARCH_RADIUS_KM
): SearchResultSummary {
  const filtered = properties.filter((prop) => {
    // 1. Property Type Filter
    if (filters.property_type && filters.property_type !== 'all' && prop.property_type !== filters.property_type) {
      return false;
    }
    // 2. Gender Preference Filter
    if (
      filters.gender &&
      filters.gender !== 'any' &&
      prop.gender_preference !== 'any' &&
      prop.gender_preference !== filters.gender
    ) {
      return false;
    }
    // 3. Room Type Filter
    if (filters.room_type && filters.room_type !== 'all' && prop.room_type !== filters.room_type) {
      return false;
    }
    // 4. Price Limits
    if (filters.max_price && prop.rent > filters.max_price) {
      return false;
    }
    if (filters.min_price && prop.rent < filters.min_price) {
      return false;
    }
    // 5. Amenities (Must have all selected amenities)
    if (filters.amenities && filters.amenities.length > 0) {
      const hasAll = filters.amenities.every((a) => prop.amenities?.includes(a));
      if (!hasAll) return false;
    }
    // 6. Verified Only
    if (filters.verified_only && !prop.is_verified) {
      return false;
    }
    // 7. Strict radius (if requested)
    if (filters.strict_radius && radiusKm > 0) {
      if (prop.distance_km !== undefined && prop.distance_km > radiusKm) {
        return false;
      }
    }
    return true;
  });

  // Sort properties
  const sorted = [...filtered];
  const sortBy = filters.sort_by || 'nearest';
  if (sortBy === 'price_low') {
    sorted.sort((a, b) => a.rent - b.rent || (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
  } else if (sortBy === 'price_high') {
    sorted.sort((a, b) => b.rent - a.rent || (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
  } else if (sortBy === 'newest') {
    sorted.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        (a.distance_km ?? 9999) - (b.distance_km ?? 9999)
    );
  } else {
    // Nearest default: ascending distance, secondary order by created_at DESC
    sorted.sort((a, b) => {
      const distA = a.distance_km ?? 9999;
      const distB = b.distance_km ?? 9999;
      if (Math.abs(distA - distB) > 0.05) {
        return distA - distB;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  // Group into standard proximity buckets
  const buckets = {
    very_near: sorted.filter((p) => p.proximity_bucket === 'very_near'),
    nearby: sorted.filter((p) => p.proximity_bucket === 'nearby'),
    nearby_areas: sorted.filter((p) => p.proximity_bucket === 'nearby_areas'),
    more_options: sorted.filter((p) => p.proximity_bucket === 'more_options'),
  };

  const exactAreaCount = buckets.very_near.length;
  const isExpanded = exactAreaCount === 0 && sorted.length > 0;
  let expandedMessage: string | undefined;

  if (isExpanded) {
    const nearestDist = sorted[0]?.distance_formatted || 'nearby';
    expandedMessage = `No active listings right inside ${refLocality}. Showing the closest options starting ${nearestDist}.`;
  }

  return {
    properties: sorted,
    reference_locality: refLocality,
    reference_city: refCity,
    reference_coordinates: { latitude: refLat, longitude: refLng },
    total_found: sorted.length,
    exact_area_count: exactAreaCount,
    is_expanded: isExpanded,
    expanded_message: expandedMessage,
    buckets,
  };
}

export const NearbyRoomsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userLocation, detectCurrentLocation, permissionState } = useLocation();
  const { currentUser, isAuthenticated } = useAuth();

  // Primary in-memory cache
  const [cachedRooms, setCachedRooms] = useState<NearbyRoomsCache | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (stored) {
        const parsed: NearbyRoomsCache = JSON.parse(stored);
        if (parsed.fetchedAt && Date.now() - parsed.fetchedAt < NEARBY_ROOMS_CACHE_TTL_MS) {
          if (import.meta.env.DEV) {
            console.log('[Rooms] Restored nearby rooms cache from sessionStorage (count:', parsed.rawProperties?.length || 0, ')');
          }
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // In-flight deduplication ref
  const inFlightPromiseRef = useRef<Promise<SearchResultSummary | null> | null>(null);
  const inFlightLocationKeyRef = useRef<string>('');

  // Track previous location to avoid spurious refetches
  const prevLocationRef = useRef<{ lat?: number; lng?: number; locality?: string; city?: string }>({});

  /**
   * Centralized Fetch Function:
   * - Deduplicates simultaneous requests
   * - Reuses cache if location has not changed significantly and TTL is valid
   * - Queries Supabase only when necessary
   */
  const fetchNearbyRooms = useCallback(
    async (options?: {
      force?: boolean;
      lat?: number;
      lng?: number;
      city?: string;
      locality?: string;
      radius_km?: number;
    }): Promise<SearchResultSummary | null> => {
      const targetLat = options?.lat ?? userLocation.latitude ?? 25.4563;
      const targetLng = options?.lng ?? userLocation.longitude ?? 81.8546;
      const targetLocality = options?.locality || userLocation.locality || 'Civil Lines';
      const targetCity = options?.city || userLocation.city || 'Prayagraj';
      const radiusKm = options?.radius_km || DEFAULT_SEARCH_RADIUS_KM;
      const force = Boolean(options?.force);

      const locationKey = `${targetCity}:${targetLocality}:${targetLat.toFixed(3)}:${targetLng.toFixed(3)}`;

      // 1. Check existing in-memory cache
      if (!force && cachedRooms) {
        const ageMs = Date.now() - cachedRooms.fetchedAt;
        const isFresh = ageMs < NEARBY_ROOMS_CACHE_TTL_MS;
        const distKm = calculateHaversineDistanceKm(
          targetLat,
          targetLng,
          cachedRooms.latitude,
          cachedRooms.longitude
        );
        const isSameLocality =
          cachedRooms.locality.toLowerCase() === targetLocality.toLowerCase() ||
          distKm <= LOCATION_CHANGE_THRESHOLD_KM;
        const isSameCity =
          !targetCity || !cachedRooms.city || targetCity.toLowerCase() === cachedRooms.city.toLowerCase();

        if (isFresh && isSameLocality && isSameCity) {
          if (import.meta.env.DEV) {
            console.log(
              `[Rooms] Using cached rooms (age: ${Math.round(ageMs / 1000)}s, dist: ${distKm.toFixed(2)}km, count: ${cachedRooms.rawProperties.length})`
            );
          }
          return cachedRooms.summary;
        }
      }

      // 2. Deduplicate in-flight requests for same location
      if (inFlightPromiseRef.current && inFlightLocationKeyRef.current === locationKey) {
        if (import.meta.env.DEV) {
          console.log('[Rooms] Joining existing in-flight rooms request for', locationKey);
        }
        return inFlightPromiseRef.current;
      }

      // 3. Execute network fetch
      if (import.meta.env.DEV) {
        console.log('[Rooms] Fetch nearby rooms from Supabase for', {
          locality: targetLocality,
          city: targetCity,
          lat: targetLat,
          lng: targetLng,
        });
      }

      setIsLoadingRooms(true);
      setRoomsError(null);
      inFlightLocationKeyRef.current = locationKey;

      const fetchPromise = (async () => {
        try {
          const searchParams: PropertySearchParams = {
            city: targetCity,
            locality: targetLocality,
            reference_lat: targetLat,
            reference_lng: targetLng,
            radius_km: radiusKm,
            location_source: userLocation.source === 'manual' ? 'manual' : 'gps',
            sort_by: 'nearest',
          };

          const summary = await propertyRepository.searchProperties(searchParams, currentUser?.id);

          const cacheEntry: NearbyRoomsCache = {
            summary,
            rawProperties: summary.properties,
            latitude: targetLat,
            longitude: targetLng,
            city: targetCity,
            locality: targetLocality,
            fetchedAt: Date.now(),
          };

          setCachedRooms(cacheEntry);

          try {
            sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cacheEntry));
          } catch {}

          return summary;
        } catch (err: any) {
          console.error('[Rooms] Failed to fetch nearby rooms:', err);
          setRoomsError(err.message || 'Failed to load nearby rooms.');
          return null;
        } finally {
          setIsLoadingRooms(false);
          inFlightPromiseRef.current = null;
          inFlightLocationKeyRef.current = '';
        }
      })();

      inFlightPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    [userLocation, cachedRooms, currentUser]
  );

  /**
   * Explicit Manual Refresh Trigger
   */
  const refreshNearbyRooms = useCallback(
    async (options?: { forceGps?: boolean }): Promise<SearchResultSummary | null> => {
      if (import.meta.env.DEV) {
        console.log('[Rooms] Cache invalidated via manual refresh');
      }

      let lat = userLocation.latitude;
      let lng = userLocation.longitude;
      let locality = userLocation.locality;
      let city = userLocation.city;

      if (options?.forceGps) {
        if (import.meta.env.DEV) {
          console.log('[Location] GPS request (explicit re-trace)');
        }
        const fresh = await detectCurrentLocation();
        if (fresh?.latitude && fresh?.longitude) {
          lat = fresh.latitude;
          lng = fresh.longitude;
          locality = fresh.locality;
          city = fresh.city;
        }
      }

      return fetchNearbyRooms({
        force: true,
        lat,
        lng,
        locality,
        city,
      });
    },
    [userLocation, detectCurrentLocation, fetchNearbyRooms]
  );

  /**
   * Invalidate memory and session cache
   */
  const invalidateCache = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('[Rooms] Cache invalidated');
    }
    setCachedRooms(null);
    try {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
    } catch {}
  }, []);

  /**
   * Instant In-Memory Filter Computation over Cached Rooms
   */
  const getFilteredRooms = useCallback(
    (filters: PropertySearchParams, searchRadiusKm?: number): SearchResultSummary | null => {
      if (!cachedRooms) return null;

      return filterAndBucketProperties(
        cachedRooms.rawProperties,
        cachedRooms.latitude,
        cachedRooms.longitude,
        cachedRooms.locality,
        cachedRooms.city,
        filters,
        searchRadiusKm || DEFAULT_SEARCH_RADIUS_KM
      );
    },
    [cachedRooms]
  );

  // Background Pre-fetch when location becomes ready or changes significantly
  useEffect(() => {
    const lat = userLocation.latitude;
    const lng = userLocation.longitude;
    const locality = userLocation.locality;
    const city = userLocation.city;

    if (!lat || !lng) return;

    const prev = prevLocationRef.current;
    let shouldFetch = false;

    if (!prev.lat || !prev.lng) {
      // First location acquisition on app open
      if (!cachedRooms) {
        shouldFetch = true;
      }
    } else {
      const dist = calculateHaversineDistanceKm(prev.lat, prev.lng, lat, lng);
      if (dist > LOCATION_CHANGE_THRESHOLD_KM) {
        if (import.meta.env.DEV) {
          console.log(
            `[Location] User moved significantly (${dist.toFixed(2)}km > ${LOCATION_CHANGE_THRESHOLD_KM}km). Triggering room refresh.`
          );
        }
        shouldFetch = true;
      } else if (prev.locality && locality && prev.locality !== locality) {
        if (import.meta.env.DEV) {
          console.log(`[Location] Locality changed from ${prev.locality} to ${locality}. Triggering room refresh.`);
        }
        shouldFetch = true;
      }
    }

    prevLocationRef.current = { lat, lng, locality, city };

    if (shouldFetch) {
      fetchNearbyRooms({ lat, lng, locality, city });
    }
  }, [userLocation.latitude, userLocation.longitude, userLocation.locality, userLocation.city, cachedRooms, fetchNearbyRooms]);

  // Login Initialization: When user authenticates, ensure location & nearby rooms are ready
  const prevAuthRef = useRef<boolean>(isAuthenticated);
  useEffect(() => {
    if (!prevAuthRef.current && isAuthenticated) {
      if (import.meta.env.DEV) {
        console.log('[Auth] User logged in. Verifying location and nearby room cache.');
      }
      if (userLocation.latitude && userLocation.longitude) {
        if (!cachedRooms) {
          fetchNearbyRooms({
            lat: userLocation.latitude,
            lng: userLocation.longitude,
            locality: userLocation.locality,
            city: userLocation.city,
          });
        }
      } else if (permissionState !== 'denied') {
        // Asynchronously detect location without blocking the UI
        detectCurrentLocation().catch(() => {});
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, userLocation, cachedRooms, permissionState, detectCurrentLocation, fetchNearbyRooms]);

  const value = useMemo<NearbyRoomsContextType>(() => {
    return {
      cachedSummary: cachedRooms?.summary || null,
      rawProperties: cachedRooms?.rawProperties || [],
      isLoadingRooms,
      roomsError,
      cacheTimestamp: cachedRooms?.fetchedAt || null,
      cachedLocation: cachedRooms
        ? {
            lat: cachedRooms.latitude,
            lng: cachedRooms.longitude,
            locality: cachedRooms.locality,
            city: cachedRooms.city,
          }
        : null,
      fetchNearbyRooms,
      refreshNearbyRooms,
      getFilteredRooms,
      invalidateCache,
    };
  }, [
    cachedRooms,
    isLoadingRooms,
    roomsError,
    fetchNearbyRooms,
    refreshNearbyRooms,
    getFilteredRooms,
    invalidateCache,
  ]);

  return <NearbyRoomsContext.Provider value={value}>{children}</NearbyRoomsContext.Provider>;
};

export const useNearbyRooms = (): NearbyRoomsContextType => {
  const ctx = useContext(NearbyRoomsContext);
  if (!ctx) {
    throw new Error('useNearbyRooms must be used within a NearbyRoomsProvider');
  }
  return ctx;
};

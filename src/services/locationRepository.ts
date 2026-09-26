import { State, District, City, LocalityInfo, Landmark, LocationData } from '../types';
import {
  ALL_INDIAN_STATES,
  ALL_INDIAN_DISTRICTS,
  ALL_INDIAN_CITIES,
  ALL_INDIAN_LOCALITIES,
  ALL_INDIAN_LANDMARKS
} from '../data/indiaLocations';
import { calculateHaversineDistanceKm } from '../utils/geo';
import { locationProvider } from './location/LocationProvider';

export interface LocationSearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'city' | 'locality' | 'landmark' | 'state' | 'address';
  state: string;
  state_code: string;
  district?: string;
  city: string;
  city_slug: string;
  locality?: string;
  locality_slug?: string;
  latitude: number;
  longitude: number;
  active_listings_count?: number;
  formatted_address?: string;
}

export interface UniversalReverseGeocodeResult {
  localityName: string;
  localitySlug?: string;
  cityName: string;
  citySlug: string;
  stateName: string;
  stateCode: string;
  districtName?: string;
  displayName: string;
  nearestLandmark?: string;
  distanceToLocalityKm: number;
  isWithinIndia: boolean;
}

export class LocationRepository {
  getStates(): State[] {
    return [...ALL_INDIAN_STATES];
  }

  getStateByCode(code: string): State | undefined {
    const clean = code.trim().toLowerCase();
    return ALL_INDIAN_STATES.find(
      (s) => s.code.toLowerCase() === clean || s.slug.toLowerCase() === clean
    );
  }

  getDistricts(stateCode?: string): District[] {
    if (!stateCode) return [...ALL_INDIAN_DISTRICTS];
    const clean = stateCode.trim().toLowerCase();
    return ALL_INDIAN_DISTRICTS.filter((d) => d.state_code.toLowerCase() === clean);
  }

  getCities(stateCode?: string, districtId?: string): City[] {
    let list = [...ALL_INDIAN_CITIES];
    if (stateCode) {
      const cleanState = stateCode.trim().toLowerCase();
      list = list.filter((c) => c.state_code.toLowerCase() === cleanState);
    }
    if (districtId) {
      const cleanDst = districtId.trim().toLowerCase();
      list = list.filter((c) => c.district_id?.toLowerCase() === cleanDst);
    }
    return list;
  }

  getPopularCities(): City[] {
    return ALL_INDIAN_CITIES.filter((c) => c.is_popular);
  }

  getCityBySlugOrName(slugOrName: string): City | undefined {
    const clean = slugOrName.trim().toLowerCase();
    return ALL_INDIAN_CITIES.find(
      (c) => c.slug === clean || c.name.toLowerCase() === clean
    );
  }

  getLocalities(citySlugOrName?: string): LocalityInfo[] {
    if (!citySlugOrName) return [...ALL_INDIAN_LOCALITIES];
    const clean = citySlugOrName.trim().toLowerCase();
    return ALL_INDIAN_LOCALITIES.filter(
      (l) => l.city_slug === clean || l.city_name.toLowerCase() === clean
    );
  }

  getLocalityBySlugOrName(
    localityNameOrSlug: string,
    citySlugOrName?: string
  ): LocalityInfo | undefined {
    const cleanLoc = localityNameOrSlug.trim().toLowerCase();
    const list = this.getLocalities(citySlugOrName);
    return list.find(
      (l) =>
        l.slug === cleanLoc ||
        l.name.toLowerCase() === cleanLoc ||
        (l.aliases && l.aliases.some((a) => a.toLowerCase() === cleanLoc)) ||
        (l.hindi_name && l.hindi_name === cleanLoc)
    );
  }

  getLandmarks(citySlugOrName?: string): Landmark[] {
    if (!citySlugOrName) return [...ALL_INDIAN_LANDMARKS];
    const clean = citySlugOrName.trim().toLowerCase();
    return ALL_INDIAN_LANDMARKS.filter(
      (lm) => lm.city_slug === clean || lm.city_name.toLowerCase() === clean
    );
  }

  /**
   * Fast Synchronous Omnibox Search:
   * Matches against Cities, Localities, Landmarks, and States across all of India.
   */
  searchLocations(query: string): LocationSearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: LocationSearchResult[] = [];
    const seen = new Set<string>();

    // 1. Match Localities
    for (const loc of ALL_INDIAN_LOCALITIES) {
      if (
        loc.name.toLowerCase().includes(q) ||
        (loc.hindi_name && loc.hindi_name.includes(q)) ||
        (loc.popular_for && loc.popular_for.toLowerCase().includes(q)) ||
        (loc.aliases && loc.aliases.some((a) => a.toLowerCase().includes(q))) ||
        `${loc.name}, ${loc.city_name}`.toLowerCase().includes(q)
      ) {
        const key = `loc-${loc.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            title: loc.name,
            subtitle: `${loc.city_name}, ${loc.state_code}`,
            type: 'locality',
            state: loc.state_name,
            state_code: loc.state_code,
            district: loc.district,
            city: loc.city_name,
            city_slug: loc.city_slug,
            locality: loc.name,
            locality_slug: loc.slug,
            latitude: loc.latitude,
            longitude: loc.longitude,
            active_listings_count: loc.active_listings_count,
            formatted_address: `${loc.name}, ${loc.city_name}, ${loc.state_code}`,
          });
        }
      }
    }

    // 2. Match Cities
    for (const city of ALL_INDIAN_CITIES) {
      if (
        city.name.toLowerCase().includes(q) ||
        city.slug.includes(q) ||
        city.state_name.toLowerCase().includes(q)
      ) {
        const key = `city-${city.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            title: city.name,
            subtitle: `${city.state_name} • City Center`,
            type: 'city',
            state: city.state_name,
            state_code: city.state_code,
            district: city.district,
            city: city.name,
            city_slug: city.slug,
            latitude: city.latitude,
            longitude: city.longitude,
            active_listings_count: city.active_listings_count,
            formatted_address: `${city.name}, ${city.state_name}`,
          });
        }
      }
    }

    // 3. Match Landmarks
    for (const lm of ALL_INDIAN_LANDMARKS) {
      if (
        lm.name.toLowerCase().includes(q) ||
        lm.short_name.toLowerCase().includes(q) ||
        lm.locality.toLowerCase().includes(q)
      ) {
        const key = `lm-${lm.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          const cityObj = this.getCityBySlugOrName(lm.city_slug);
          results.push({
            id: key,
            title: lm.short_name || lm.name,
            subtitle: `${lm.locality}, ${lm.city_name}`,
            type: 'landmark',
            state: cityObj?.state_name || 'India',
            state_code: cityObj?.state_code || '',
            city: lm.city_name,
            city_slug: lm.city_slug,
            locality: lm.locality,
            latitude: lm.latitude,
            longitude: lm.longitude,
            formatted_address: `${lm.short_name || lm.name} (${lm.locality}, ${lm.city_name})`,
          });
        }
      }
    }

    // 4. Match States
    for (const st of ALL_INDIAN_STATES) {
      if (st.name.toLowerCase().includes(q) || st.code.toLowerCase() === q) {
        const key = `st-${st.code}`;
        if (!seen.has(key)) {
          seen.add(key);
          const capitalCity = ALL_INDIAN_CITIES.find(
            (c) => c.state_code === st.code
          );
          if (!capitalCity) continue;
          results.push({
            id: key,
            title: st.name,
            subtitle: `${st.type === 'ut' ? 'Union Territory' : 'State'} in India`,
            type: 'state',
            state: st.name,
            state_code: st.code,
            city: capitalCity.name,
            city_slug: capitalCity.slug,
            latitude: capitalCity.latitude,
            longitude: capitalCity.longitude,
            formatted_address: `${st.name}, India`,
          });
        }
      }
    }

    return results.slice(0, 15);
  }

  /**
   * Asynchronous search delegating to LocationProvider with OpenStreetMap fallback
   */
  async searchLocationsAsync(query: string, signal?: AbortSignal): Promise<LocationData[]> {
    return locationProvider.searchLocations(query, signal);
  }

  /**
   * Reverse-geocodes coordinates into the nearest Indian city, locality, and landmark.
   * Works nationwide with high precision.
   */
  reverseGeocode(latitude: number, longitude: number): UniversalReverseGeocodeResult {
    // 1. Determine closest city
    let closestCity = ALL_INDIAN_CITIES[0];
    let minCityDist = calculateHaversineDistanceKm(
      latitude,
      longitude,
      closestCity.latitude,
      closestCity.longitude
    );

    for (let i = 1; i < ALL_INDIAN_CITIES.length; i++) {
      const dist = calculateHaversineDistanceKm(
        latitude,
        longitude,
        ALL_INDIAN_CITIES[i].latitude,
        ALL_INDIAN_CITIES[i].longitude
      );
      if (dist < minCityDist) {
        minCityDist = dist;
        closestCity = ALL_INDIAN_CITIES[i];
      }
    }

    // 2. Determine closest locality
    let closestLocality = ALL_INDIAN_LOCALITIES[0];
    let minLocDist = calculateHaversineDistanceKm(
      latitude,
      longitude,
      closestLocality.latitude,
      closestLocality.longitude
    );

    for (let i = 1; i < ALL_INDIAN_LOCALITIES.length; i++) {
      const dist = calculateHaversineDistanceKm(
        latitude,
        longitude,
        ALL_INDIAN_LOCALITIES[i].latitude,
        ALL_INDIAN_LOCALITIES[i].longitude
      );
      if (dist < minLocDist) {
        minLocDist = dist;
        closestLocality = ALL_INDIAN_LOCALITIES[i];
      }
    }

    // 3. Determine if there is a very close landmark (< 2.5km)
    let nearestLandmark: string | undefined = undefined;
    const cityLandmarks = this.getLandmarks(closestLocality.city_slug);
    for (const lm of cityLandmarks) {
      const dist = calculateHaversineDistanceKm(latitude, longitude, lm.latitude, lm.longitude);
      if (dist < 2.5) {
        nearestLandmark = lm.short_name || lm.name;
        break;
      }
    }

    const isWithinIndia = latitude >= 8 && latitude <= 37 && longitude >= 68 && longitude <= 98;

    let displayName = `Near ${closestLocality.name}, ${closestLocality.city_name}`;
    if (minLocDist > 25) {
      displayName = `${closestCity.name} Region, ${closestCity.state_code}`;
    }

    const useLocality = minLocDist < 25;
    return {
      localityName: useLocality ? closestLocality.name : closestCity.name,
      localitySlug: useLocality ? closestLocality.slug : closestCity.slug,
      cityName: useLocality ? closestLocality.city_name : closestCity.name,
      citySlug: useLocality ? closestLocality.city_slug : closestCity.slug,
      stateName: useLocality ? closestLocality.state_name : closestCity.state_name,
      stateCode: useLocality ? closestLocality.state_code : closestCity.state_code,
      districtName: (useLocality ? closestLocality.district : undefined) || closestCity.district,
      displayName,
      nearestLandmark,
      distanceToLocalityKm: minLocDist,
      isWithinIndia,
    };
  }

  async reverseGeocodeAsync(
    latitude: number,
    longitude: number,
    signal?: AbortSignal
  ): Promise<LocationData> {
    return locationProvider.reverseGeocode(latitude, longitude, signal);
  }
}

export const locationRepository = new LocationRepository();

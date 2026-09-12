import { LocationData } from '../../types';
import {
  ALL_INDIAN_STATES,
  ALL_INDIAN_CITIES,
  ALL_INDIAN_LOCALITIES,
  ALL_INDIAN_LANDMARKS
} from '../../data/indiaLocations';
import {
  normalizeNominatimPlace,
  normalizeLocalityToLocationData,
  normalizeCityToLocationData,
  normalizeLandmarkToLocationData,
  NominatimPlace
} from './locationNormalizer';
import { locationCache } from './locationCache';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_SEARCH_LENGTH = 2;

// Simple rate limiter: ensure at least 800ms between external API calls to respect Nominatim policy
let lastExternalCallTime = 0;

export class Geocoder {
  /**
   * Searches locations across India:
   * 1. Checks memory & localStorage cache
   * 2. Searches fast normalized local catalog (States, Cities, Localities, Landmarks)
   * 3. Calls OpenStreetMap Nominatim with AbortController for granular street/area matches
   */
  async search(query: string, signal?: AbortSignal): Promise<LocationData[]> {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_SEARCH_LENGTH) return [];

    // 1. Check Cache
    const cached = locationCache.getSearch(q);
    if (cached && cached.length > 0) {
      return cached;
    }

    const results: LocationData[] = [];
    const seenCoordinates = new Set<string>();

    const addUnique = (item: LocationData) => {
      const coordKey = `${item.latitude.toFixed(3)}_${item.longitude.toFixed(3)}`;
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        results.push(item);
      }
    };

    // 2. Search Local Catalog First (Sub-millisecond offline matching)
    // A. Localities
    for (const loc of ALL_INDIAN_LOCALITIES) {
      if (
        loc.name.toLowerCase().includes(q) ||
        (loc.hindi_name && loc.hindi_name.includes(q)) ||
        `${loc.name}, ${loc.city_name}`.toLowerCase().includes(q)
      ) {
        addUnique(normalizeLocalityToLocationData(loc, 'search'));
      }
    }

    // B. Cities
    for (const city of ALL_INDIAN_CITIES) {
      if (
        city.name.toLowerCase().includes(q) ||
        city.slug.includes(q) ||
        city.state_name.toLowerCase().includes(q)
      ) {
        addUnique(normalizeCityToLocationData(city, 'search'));
      }
    }

    // C. Landmarks
    for (const lm of ALL_INDIAN_LANDMARKS) {
      if (
        lm.name.toLowerCase().includes(q) ||
        lm.short_name.toLowerCase().includes(q) ||
        lm.locality.toLowerCase().includes(q)
      ) {
        const stateName =
          ALL_INDIAN_CITIES.find((c) => c.slug === lm.city_slug)?.state_name || 'India';
        addUnique(normalizeLandmarkToLocationData(lm, stateName, 'search'));
      }
    }

    // D. States (if query matches a state name, return its capital / primary city)
    for (const st of ALL_INDIAN_STATES) {
      if (st.name.toLowerCase().includes(q) || st.code.toLowerCase() === q) {
        const stateCities = ALL_INDIAN_CITIES.filter((c) => c.state_code === st.code);
        for (const sc of stateCities) {
          addUnique(normalizeCityToLocationData(sc, 'search'));
        }
      }
    }

    // If local catalog gave strong matches (>= 3), cache and return immediately
    if (results.length >= 3) {
      const finalResults = results.slice(0, 10);
      locationCache.setSearch(q, finalResults);
      return finalResults;
    }

    // 3. Fallback to OpenStreetMap Nominatim for freeform / uncataloged Indian addresses
    try {
      // Throttle calls to respect Nominatim policy
      const now = Date.now();
      const timeSinceLastCall = now - lastExternalCallTime;
      if (timeSinceLastCall < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - timeSinceLastCall));
      }
      lastExternalCallTime = Date.now();

      const url = `${NOMINATIM_BASE_URL}?q=${encodeURIComponent(
        query + ', India'
      )}&format=json&addressdetails=1&countrycodes=in&limit=6`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RentedThikan/1.0 (contact@rentedthikan.in)',
        },
        signal,
      });

      if (response.ok) {
        const data: NominatimPlace[] = await response.json();
        for (const place of data) {
          const normalized = normalizeNominatimPlace(place, 'search');
          addUnique(normalized);
        }
      }
    } catch (e: any) {
      // Handle network errors or AbortController aborts gracefully
      if (e.name !== 'AbortError') {
        console.warn('Nominatim search non-fatal fallback:', e);
      }
    }

    const finalResults = results.slice(0, 10);
    if (finalResults.length > 0) {
      locationCache.setSearch(q, finalResults);
    }
    return finalResults;
  }
}

export const geocoder = new Geocoder();

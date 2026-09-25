import { LocationData } from '../../types';
import {
  ALL_INDIAN_CITIES,
  ALL_INDIAN_LOCALITIES,
  ALL_INDIAN_LANDMARKS
} from '../../data/indiaLocations';
import { calculateHaversineDistanceKm } from '../../utils/geo';
import { normalizeNominatimPlace, NominatimPlace } from './locationNormalizer';
import { locationCache } from './locationCache';

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
let lastReverseCallTime = 0;

export class ReverseGeocoder {
  async reverse(latitude: number, longitude: number, signal?: AbortSignal): Promise<LocationData> {
    // 1. Check Cache
    const cached = locationCache.getReverse(latitude, longitude);
    if (cached) {
      return cached;
    }

    // 2. Determine nearest landmark if available (< 2.5km)
    let nearestLandmark: string | undefined = undefined;
    for (const lm of ALL_INDIAN_LANDMARKS) {
      const dist = calculateHaversineDistanceKm(latitude, longitude, lm.latitude, lm.longitude);
      if (dist < 2.5) {
        nearestLandmark = lm.short_name || lm.name;
        break;
      }
    }

    // 3. Primary: High-Accuracy Reverse Geocode via OpenStreetMap Nominatim (zoom=18 for house/street level)
    try {
      const now = Date.now();
      const timeSinceLastCall = now - lastReverseCallTime;
      if (timeSinceLastCall < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - timeSinceLastCall));
      }
      lastReverseCallTime = Date.now();

      const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RentedThikan/1.0 (contact@rentedthikan.in)',
        },
        signal,
      });

      if (response.ok) {
        const data: NominatimPlace = await response.json();
        const normalized = normalizeNominatimPlace(data, 'gps');
        normalized.latitude = latitude;
        normalized.longitude = longitude;
        if (nearestLandmark && !normalized.landmark) {
          normalized.landmark = nearestLandmark;
        }
        locationCache.setReverse(latitude, longitude, normalized);
        return normalized;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Live reverse geocoding failed, falling back to local catalog:', e);
      }
    }

    // 4. Offline Fallback: Nearest-Neighbor Proximity Match from static catalog
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

    const fallbackLocality = minLocDist < 20 ? closestLocality.name : closestCity.name;
    const fallbackDisplayName = `${fallbackLocality}, ${closestCity.name}, ${closestCity.state_name}`;

    const fallbackResult: LocationData = {
      country: 'India',
      countryCode: 'IN',
      state: closestCity.state_name,
      stateCode: closestCity.state_code,
      district: closestCity.district || closestCity.name,
      city: closestCity.name,
      citySlug: closestCity.slug,
      locality: fallbackLocality,
      localitySlug: minLocDist < 20 ? closestLocality.slug : closestCity.slug,
      landmark: nearestLandmark,
      formattedAddress: fallbackDisplayName,
      latitude,
      longitude,
      source: 'gps',
    };

    locationCache.setReverse(latitude, longitude, fallbackResult);
    return fallbackResult;
  }
}

export const reverseGeocoder = new ReverseGeocoder();

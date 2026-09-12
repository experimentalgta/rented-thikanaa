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

    // 2. Offline Nearest-Neighbor Proximity Match
    // Find closest city
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

    // Find closest locality
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

    // Check for nearby landmark (< 2.5km)
    let nearestLandmark: string | undefined = undefined;
    const cityLandmarks = ALL_INDIAN_LANDMARKS.filter(
      (lm) => lm.city_slug === closestLocality.city_slug
    );
    for (const lm of cityLandmarks) {
      const dist = calculateHaversineDistanceKm(latitude, longitude, lm.latitude, lm.longitude);
      if (dist < 2.5) {
        nearestLandmark = lm.short_name || lm.name;
        break;
      }
    }

    // If coordinates are within close range of a known locality (< 8km), build high-confidence local result
    if (minLocDist < 8.0) {
      const displayName = `Near ${closestLocality.name}, ${closestLocality.city_name}`;
      const result: LocationData = {
        country: 'India',
        countryCode: 'IN',
        state: closestLocality.state_name,
        stateCode: closestLocality.state_code,
        district: closestLocality.district || closestLocality.city_name,
        city: closestLocality.city_name,
        citySlug: closestLocality.city_slug,
        locality: closestLocality.name,
        localitySlug: closestLocality.slug,
        landmark: nearestLandmark,
        formattedAddress: `${closestLocality.name}, ${closestLocality.city_name}, ${closestLocality.state_code}`,
        latitude,
        longitude,
        source: 'gps',
      };
      locationCache.setReverse(latitude, longitude, result);
      return result;
    }

    // 3. If outside close catalog locality bounds, attempt OpenStreetMap Nominatim reverse geocode
    try {
      const now = Date.now();
      const timeSinceLastCall = now - lastReverseCallTime;
      if (timeSinceLastCall < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - timeSinceLastCall));
      }
      lastReverseCallTime = Date.now();

      const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
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
        normalized.landmark = nearestLandmark;
        locationCache.setReverse(latitude, longitude, normalized);
        return normalized;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Nominatim reverse geocode fallback:', e);
      }
    }

    // 4. Graceful Fallback using closest catalog City/Locality
    const fallbackDisplayName =
      minLocDist < 20
        ? `Near ${closestLocality.name}, ${closestLocality.city_name}`
        : `${closestCity.name} Region, ${closestCity.state_name}`;

    const fallbackResult: LocationData = {
      country: 'India',
      countryCode: 'IN',
      state: closestCity.state_name,
      stateCode: closestCity.state_code,
      district: closestCity.district || closestCity.name,
      city: closestCity.name,
      citySlug: closestCity.slug,
      locality: minLocDist < 20 ? closestLocality.name : closestCity.name,
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

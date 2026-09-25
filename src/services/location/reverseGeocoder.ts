import { LocationData } from '../../types';
import {
  ALL_INDIAN_CITIES,
  ALL_INDIAN_LOCALITIES,
  ALL_INDIAN_LANDMARKS
} from '../../data/indiaLocations';
import { calculateHaversineDistanceKm } from '../../utils/geo';
import { normalizeNominatimPlace, normalizePhotonFeature, NominatimPlace } from './locationNormalizer';
import { locationCache } from './locationCache';

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
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

    // 3. Primary: High-Accuracy Reverse Geocode via OpenStreetMap Nominatim (zoom=18 for house/street/neighborhood level)
    try {
      const now = Date.now();
      const timeSinceLastCall = now - lastReverseCallTime;
      if (timeSinceLastCall < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - timeSinceLastCall));
      }
      lastReverseCallTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: NominatimPlace = await response.json();
        const normalized = normalizeNominatimPlace(data, 'gps');
        normalized.latitude = latitude;
        normalized.longitude = longitude;
        if (nearestLandmark && !normalized.landmark) {
          normalized.landmark = nearestLandmark;
        }

        if (import.meta.env.DEV) {
          console.log('[GPS Debug] Coordinates:', { latitude, longitude });
          console.log('[GPS Debug] Reverse Geocoder raw components:', {
            road: data.address?.road,
            neighbourhood: data.address?.neighbourhood || data.address?.neighborhood,
            suburb: data.address?.suburb,
            residential: data.address?.residential,
            quarter: data.address?.quarter,
            locality: data.address?.locality,
            city_district: data.address?.city_district,
            district: data.address?.state_district || data.address?.county,
            city: data.address?.city || data.address?.town,
            state: data.address?.state,
            postcode: data.address?.postcode,
          });
          console.log('[GPS Debug] Resolved Locality:', normalized.locality);
          console.log('[GPS Debug] Formatted Address:', normalized.formattedAddress);
        }

        locationCache.setReverse(latitude, longitude, normalized);
        return normalized;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Live Nominatim reverse geocoding failed, trying secondary geocoder:', e);
      }
    }

    // 4. Secondary: Photon OpenStreetMap Reverse Geocode Fallback
    try {
      const photonController = new AbortController();
      const photonTimer = setTimeout(() => photonController.abort(), 6000);
      if (signal) {
        signal.addEventListener('abort', () => photonController.abort(), { once: true });
      }

      const photonUrl = `${PHOTON_REVERSE_URL}?lat=${latitude}&lon=${longitude}`;
      const photonRes = await fetch(photonUrl, {
        headers: { Accept: 'application/json' },
        signal: photonController.signal,
      });
      clearTimeout(photonTimer);

      if (photonRes.ok) {
        const photonData = await photonRes.json();
        const feature = photonData.features?.[0];
        if (feature) {
          const normalized = normalizePhotonFeature(feature, latitude, longitude, 'gps');
          if (nearestLandmark && !normalized.landmark) {
            normalized.landmark = nearestLandmark;
          }

          if (import.meta.env.DEV) {
            console.log('[GPS Debug: Photon Fallback]', {
              latitude,
              longitude,
              featureProperties: feature.properties,
              resolvedLocality: normalized.locality,
              formattedAddress: normalized.formattedAddress,
            });
          }

          locationCache.setReverse(latitude, longitude, normalized);
          return normalized;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Secondary Photon geocoder failed:', err);
      }
    }

    // 5. Offline Fallback: Nearest-Neighbor Proximity Match from static catalog
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

    // Strict proximity: only use locality name if within 4km, else do not guess wrong neighborhood
    const isCloseToLocality = minLocDist < 4.0 && closestLocality.city_slug === closestCity.slug;
    const fallbackLocality = isCloseToLocality ? closestLocality.name : closestCity.name;
    const fallbackDisplayName = isCloseToLocality
      ? `${closestLocality.name}, ${closestCity.name}, ${closestCity.state_name}`
      : `${closestCity.name}, ${closestCity.state_name}`;

    const fallbackResult: LocationData = {
      country: 'India',
      countryCode: 'IN',
      state: closestCity.state_name,
      stateCode: closestCity.state_code,
      district: closestCity.district || closestCity.name,
      city: closestCity.name,
      citySlug: closestCity.slug,
      locality: fallbackLocality,
      localitySlug: isCloseToLocality ? closestLocality.slug : closestCity.slug,
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

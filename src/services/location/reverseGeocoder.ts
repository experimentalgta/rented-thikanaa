import { LocationData } from '../../types';
import {
  ALL_INDIAN_CITIES,
  ALL_INDIAN_LOCALITIES,
  ALL_INDIAN_LANDMARKS
} from '../../data/indiaLocations';
import { calculateHaversineDistanceKm } from '../../utils/geo';
import {
  normalizeNominatimPlace,
  normalizePhotonFeature,
  snapToAccurateLocality,
  NominatimPlace
} from './locationNormalizer';
import { locationCache } from './locationCache';

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
const BIGDATACLOUD_REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
let lastReverseCallTime = 0;

export class ReverseGeocoder {
  private refineLocation(loc: LocationData, rawText?: string): LocationData {
    const refined = snapToAccurateLocality(
      loc.latitude,
      loc.longitude,
      loc.city,
      loc.locality,
      rawText
    );

    if (refined.isSnapped) {
      loc.locality = refined.locality;
      loc.localitySlug = refined.localitySlug;
      if (refined.city) {
        loc.city = refined.city;
      }
      loc.formattedAddress = `${loc.locality}, ${loc.city}${loc.state ? ', ' + loc.state : ''}`;
    }
    return loc;
  }

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

        const rawText = `${data.display_name || ''} ${data.address?.road || ''} ${data.address?.neighbourhood || ''} ${data.address?.suburb || ''}`;
        this.refineLocation(normalized, rawText);

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
          console.log('[GPS Debug] Resolved Locality (refined):', normalized.locality);
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

          const rawText = `${feature.properties?.name || ''} ${feature.properties?.street || ''} ${feature.properties?.district || ''} ${feature.properties?.city || ''}`;
          this.refineLocation(normalized, rawText);

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

    // 4.5 Tertiary: BigDataCloud Client-side Reverse Geocoding (public-apis)
    try {
      const bdcController = new AbortController();
      const bdcTimer = setTimeout(() => bdcController.abort(), 4000);
      if (signal) {
        signal.addEventListener('abort', () => bdcController.abort(), { once: true });
      }

      const bdcUrl = `${BIGDATACLOUD_REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
      const bdcRes = await fetch(bdcUrl, {
        headers: { Accept: 'application/json' },
        signal: bdcController.signal,
      });
      clearTimeout(bdcTimer);

      if (bdcRes.ok) {
        const bdc = await bdcRes.json();
        if (bdc.city || bdc.principalSubdivision) {
          const stateName = bdc.principalSubdivision || 'Uttar Pradesh';
          const stateCode = bdc.principalSubdivisionCode ? bdc.principalSubdivisionCode.replace('IN-', '') : 'UP';
          const cityName = bdc.city || bdc.locality || 'Prayagraj';
          const localityName = bdc.locality || bdc.city || '';
          const cleanLocalitySlug = localityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const cleanCitySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          const normalized: LocationData = {
            country: 'India',
            countryCode: 'IN',
            formattedAddress: [localityName, cityName, stateName].filter(Boolean).join(', '),
            state: stateName,
            stateCode,
            city: cityName,
            citySlug: cleanCitySlug,
            locality: localityName,
            localitySlug: cleanLocalitySlug,
            pincode: bdc.postcode || '',
            latitude,
            longitude,
            landmark: nearestLandmark,
            source: 'gps',
          };

          this.refineLocation(normalized, `${bdc.locality || ''} ${bdc.city || ''}`);

          if (import.meta.env.DEV) {
            console.log('[GPS Debug: BigDataCloud Fallback]', {
              latitude,
              longitude,
              cityName,
              localityName: normalized.locality,
              stateName,
            });
          }

          locationCache.setReverse(latitude, longitude, normalized);
          return normalized;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Tertiary BigDataCloud geocoder failed:', err);
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
    const refined = snapToAccurateLocality(latitude, longitude, closestCity.name, fallbackLocality);
    const finalLocality = refined.isSnapped ? refined.locality : fallbackLocality;
    const finalLocalitySlug = refined.isSnapped ? refined.localitySlug : (isCloseToLocality ? closestLocality.slug : closestCity.slug);
    const finalCity = refined.city || closestCity.name;

    const fallbackResult: LocationData = {
      country: 'India',
      countryCode: 'IN',
      state: closestCity.state_name,
      stateCode: closestCity.state_code,
      district: closestCity.district || finalCity,
      city: finalCity,
      citySlug: closestCity.slug,
      locality: finalLocality,
      localitySlug: finalLocalitySlug,
      landmark: nearestLandmark,
      formattedAddress: `${finalLocality}, ${finalCity}, ${closestCity.state_name}`,
      latitude,
      longitude,
      source: 'gps',
    };

    locationCache.setReverse(latitude, longitude, fallbackResult);
    return fallbackResult;
  }
}

export const reverseGeocoder = new ReverseGeocoder();

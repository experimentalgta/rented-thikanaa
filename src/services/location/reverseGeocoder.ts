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

    // 3. Primary: High-Accuracy Fast CORS Client-side Reverse Geocoding via BigDataCloud
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

          // Extract granular administrative area (tehsil, taluk, ward) if available
          let subArea = '';
          if (Array.isArray(bdc.localityInfo?.administrative)) {
            for (const admin of bdc.localityInfo.administrative) {
              if (admin.name && admin.adminLevel >= 6 && !admin.name.toLowerCase().includes('district')) {
                const clean = admin.name.replace(/\s+(tehsil|taluk|block|division|corporation)$/i, '').trim();
                if (clean && clean.toLowerCase() !== cityName.toLowerCase() && !clean.toLowerCase().includes('allahabad')) {
                  subArea = clean;
                  break;
                }
              }
            }
          }

          const rawLocality = bdc.locality && bdc.locality.toLowerCase() !== cityName.toLowerCase()
            ? bdc.locality
            : subArea || cityName;

          const cleanLocalitySlug = rawLocality.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const cleanCitySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          const normalized: LocationData = {
            country: 'India',
            countryCode: 'IN',
            formattedAddress: [rawLocality, cityName, stateName].filter(Boolean).join(', '),
            state: stateName,
            stateCode,
            city: cityName,
            citySlug: cleanCitySlug,
            locality: rawLocality,
            localitySlug: cleanLocalitySlug,
            pincode: bdc.postcode || '',
            latitude,
            longitude,
            landmark: nearestLandmark,
            source: 'gps',
          };

          this.refineLocation(normalized, `${rawLocality} ${bdc.locality || ''} ${cityName}`);

          if (import.meta.env.DEV) {
            console.log('[GPS: BigDataCloud Success]', {
              latitude,
              longitude,
              cityName,
              locality: normalized.locality,
              formattedAddress: normalized.formattedAddress,
            });
          }

          locationCache.setReverse(latitude, longitude, normalized);
          return normalized;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('BigDataCloud geocoder failed, trying fallback:', err);
      }
    }

    // 4. Secondary: OpenStreetMap Nominatim / Photon (if available/supported)
    try {
      const now = Date.now();
      const timeSinceLastCall = now - lastReverseCallTime;
      if (timeSinceLastCall < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - timeSinceLastCall));
      }
      lastReverseCallTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
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

        locationCache.setReverse(latitude, longitude, normalized);
        return normalized;
      }
    } catch (e: any) {
      // Ignore Nominatim browser CORS failures
    }

    // 5. Offline Fallback: Nearest-Neighbor Proximity Match strictly scoped to same city
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

    const sameCityLocalities = ALL_INDIAN_LOCALITIES.filter((l) => l.city_slug === closestCity.slug);
    let closestLocality = sameCityLocalities[0];
    let minLocDist = 999999;

    for (const loc of sameCityLocalities) {
      const dist = calculateHaversineDistanceKm(
        latitude,
        longitude,
        loc.latitude,
        loc.longitude
      );
      if (dist < minLocDist) {
        minLocDist = dist;
        closestLocality = loc;
      }
    }

    // Strict proximity: only use locality name if within 2.5km and belongs to the same city
    const isCloseToLocality = minLocDist <= 2.5 && Boolean(closestLocality);
    const fallbackLocality = isCloseToLocality ? closestLocality.name : closestCity.name;
    const refined = snapToAccurateLocality(latitude, longitude, closestCity.name, fallbackLocality);
    const finalLocality = refined.isSnapped ? refined.locality : fallbackLocality;
    const finalLocalitySlug = refined.isSnapped ? refined.localitySlug : (isCloseToLocality ? closestLocality.slug : closestCity.slug);
    const finalCity = closestCity.name;

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

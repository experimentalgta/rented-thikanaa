/**
 * Central Location Service for Rented Thikanaa
 * Unified implementation shared across Search, Listing, and App Navigation
 */

import { LocationData, UserLocationState } from '../../types';
import { locationRepository } from '../locationRepository';
import { evaluateLocationAccuracy } from './locationAccuracy';
import { locationCache } from './locationCache';

export interface GpsPositionResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface DetectedLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  district?: string;
  city: string;
  citySlug: string;
  locality: string;
  localitySlug: string;
  displayName: string;
  formattedAddress: string;
  landmark?: string;
  pincode?: string;
  isLowAccuracy: boolean;
  accuracyLabel: string;
}

export const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 300000,
};

export class LocationService {
  private formatGeoError(err: GeolocationPositionError): Error {
    let msg = "We couldn't detect your location. Please enter your location manually.";
    if (err.code === 1) {
      msg = 'Location permission was denied. You can enter your location manually.';
    } else if (err.code === 2) {
      msg = "We couldn't detect your location. Please enter your location manually.";
    } else if (err.code === 3) {
      msg = 'Location request timed out. Please enter your location manually or retry.';
    }
    const error = new Error(msg);
    (error as any).code = err.code;
    return error;
  }

  /**
   * High-accuracy device GPS acquisition using the browser's native Geolocation API:
   * Uses enableHighAccuracy: true with a sensible 12-15s timeout for satellite/GPS hardware lock.
   */
  async getCurrentPosition(options?: PositionOptions, forceFresh?: boolean): Promise<GpsPositionResult> {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported on this device or browser.');
    }

    const primaryOptions: PositionOptions = options || {
      enableHighAccuracy: true,
      timeout: forceFresh ? 15000 : 12000,
      maximumAge: forceFresh ? 0 : 300000,
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          resolve({ latitude, longitude, accuracy });
        },
        (err) => {
          // If high-accuracy timed out on a cold satellite lock, attempt one graceful retry
          if (err.code === 3 && !forceFresh) {
            navigator.geolocation.getCurrentPosition(
              (retryPos) => {
                const { latitude, longitude, accuracy } = retryPos.coords;
                resolve({ latitude, longitude, accuracy });
              },
              (retryErr) => {
                reject(this.formatGeoError(retryErr));
              },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
            return;
          }
          reject(this.formatGeoError(err));
        },
        primaryOptions
      );
    });
  }

  /**
   * High-accuracy reverse geocoding via Nominatim -> Photon -> BigDataCloud -> Catalog fallback.
   */
  async reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<LocationData> {
    return locationRepository.reverseGeocodeAsync(latitude, longitude, signal);
  }

  /**
   * Full discovery pipeline:
   * 1. Get fast GPS coordinates
   * 2. Reverse geocode to authentic City and Area/Locality
   * 3. Evaluate accuracy
   */
  async detectLocation(signal?: AbortSignal, forceFresh?: boolean): Promise<DetectedLocationResult> {
    if (forceFresh) {
      locationCache.clearReverse();
    }

    const coords = await this.getCurrentPosition(undefined, forceFresh);
    const evalAcc = evaluateLocationAccuracy(coords.accuracy, 'gps');

    let rev: LocationData;
    try {
      rev = await this.reverseGeocode(coords.latitude, coords.longitude, signal);
    } catch {
      const syncRev = locationRepository.reverseGeocode(coords.latitude, coords.longitude);
      rev = {
        country: 'India',
        state: syncRev.stateName,
        stateCode: syncRev.stateCode,
        district: syncRev.districtName,
        city: syncRev.cityName,
        citySlug: syncRev.citySlug,
        locality: syncRev.localityName,
        localitySlug: syncRev.localitySlug,
        formattedAddress: syncRev.displayName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        landmark: syncRev.nearestLandmark,
        source: 'gps',
      };
    }

    const city = rev.city || 'Prayagraj';
    const citySlug = rev.citySlug || city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const locality = rev.locality || city;
    const localitySlug = rev.localitySlug || locality.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const state = rev.state || 'Uttar Pradesh';
    const stateCode = rev.stateCode || 'UP';

    let displayName = rev.formattedAddress;
    if (!displayName) {
      displayName = locality !== city ? `${locality}, ${city}` : city;
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      country: rev.country || 'India',
      countryCode: rev.countryCode || 'IN',
      state,
      stateCode,
      district: rev.district,
      city,
      citySlug,
      locality,
      localitySlug,
      displayName,
      formattedAddress: rev.formattedAddress || `${locality}, ${city}, ${state}`,
      landmark: rev.landmark,
      pincode: rev.pincode,
      isLowAccuracy: evalAcc.isLowAccuracy,
      accuracyLabel: evalAcc.accuracyLabel,
    };
  }

  /**
   * Convert detected result into UserLocationState format for LocationContext
   */
  toUserLocationState(detected: DetectedLocationResult): UserLocationState {
    return {
      latitude: detected.latitude,
      longitude: detected.longitude,
      country: detected.country,
      countryCode: detected.countryCode,
      state: detected.state,
      stateCode: detected.stateCode,
      district: detected.district,
      city: detected.city,
      citySlug: detected.citySlug,
      locality: detected.locality,
      localitySlug: detected.localitySlug,
      displayName: detected.displayName,
      formattedAddress: detected.formattedAddress,
      landmark: detected.landmark,
      source: 'gps',
      accuracy: detected.accuracy,
      isLowAccuracy: detected.isLowAccuracy,
      accuracyLabel: detected.accuracyLabel,
      timestamp: Date.now(),
    };
  }
}

export const locationService = new LocationService();

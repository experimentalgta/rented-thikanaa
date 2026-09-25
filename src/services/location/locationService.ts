/**
 * Central Location Service for Rented Thikanaa
 * Unified implementation shared across Search, Listing, and App Navigation
 */

import { LocationData, UserLocationState } from '../../types';
import { locationRepository } from '../locationRepository';
import { evaluateLocationAccuracy } from './locationAccuracy';

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
  timeout: 20000,
  maximumAge: 0,
};

export class LocationService {
  /**
   * Captures fresh GPS coordinates from browser/device.
   * High accuracy, no cached coordinates (maximumAge: 0), 20s timeout.
   */
  async getCurrentPosition(options: PositionOptions = GPS_OPTIONS): Promise<GpsPositionResult> {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported on this device or browser.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          resolve({ latitude, longitude, accuracy });
        },
        (err) => {
          let msg = "We couldn't detect your location. Please check browser permissions.";
          if (err.code === 1) {
            msg = 'Location permission was denied. Please enable location permissions or choose your location manually.';
          } else if (err.code === 2) {
            msg = 'Location information is unavailable on your device. Please choose your location manually.';
          } else if (err.code === 3) {
            msg = 'Location request timed out. Please try again or choose your location manually.';
          }
          const error = new Error(msg);
          (error as any).code = err.code;
          reject(error);
        },
        options
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
   * 1. Get fresh GPS coordinates
   * 2. Reverse geocode to authentic City and Area/Locality
   * 3. Evaluate accuracy
   */
  async detectLocation(signal?: AbortSignal): Promise<DetectedLocationResult> {
    const coords = await this.getCurrentPosition();
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
    const locality = rev.locality || rev.city || 'Civil Lines';
    const localitySlug = rev.localitySlug || locality.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const state = rev.state || 'Uttar Pradesh';
    const stateCode = rev.stateCode || 'UP';

    const displayName = rev.formattedAddress || `${locality}, ${city}`;

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

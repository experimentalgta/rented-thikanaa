import { ILocationProvider } from './types';
import { LocationData } from '../../types';
import { geocoder } from './geocoder';
import { reverseGeocoder } from './reverseGeocoder';

export class LocationProvider implements ILocationProvider {
  async searchLocations(query: string, signal?: AbortSignal): Promise<LocationData[]> {
    return geocoder.search(query, signal);
  }

  async reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<LocationData> {
    return reverseGeocoder.reverse(latitude, longitude, signal);
  }

  async getPlaceDetails(_placeId: string, _signal?: AbortSignal): Promise<LocationData | null> {
    return null;
  }
}

export const locationProvider = new LocationProvider();

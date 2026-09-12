import { LocationData, LocationSource, State, District, City, Locality, Landmark } from '../../types';

export interface ILocationProvider {
  searchLocations(query: string, signal?: AbortSignal): Promise<LocationData[]>;
  reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal): Promise<LocationData>;
  getPlaceDetails?(placeId: string, signal?: AbortSignal): Promise<LocationData | null>;
}

export interface GeocodingResult extends LocationData {}

export interface ReverseGeocodingResult extends LocationData {
  nearestLandmark?: string;
  distanceToLocalityKm: number;
}

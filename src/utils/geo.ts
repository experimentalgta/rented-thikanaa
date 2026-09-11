import { ProximityBucket } from '../types';

/**
 * Earth radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Formats a distance in kilometers to user-friendly Indian-English format:
 * - "< 1 km" -> "450 m away"
 * - ">= 1 km" -> "1.8 km away"
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.max(50, Math.round((distanceKm * 1000) / 50) * 50);
    return `${meters} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Maps a distance in kilometers to its UI presentation bucket.
 */
export function getProximityBucket(distanceKm: number): ProximityBucket {
  if (distanceKm < 1.0) return 'very_near';
  if (distanceKm < 3.0) return 'nearby';
  if (distanceKm < 5.0) return 'nearby_areas';
  return 'more_options';
}

export const PROXIMITY_BUCKET_LABELS: Record<ProximityBucket, { title: string; subtitle: string }> = {
  very_near: {
    title: 'Very Near',
    subtitle: 'Within 1 km of your target location',
  },
  nearby: {
    title: 'Nearby',
    subtitle: 'Between 1 km and 3 km away',
  },
  nearby_areas: {
    title: 'Nearby Localities',
    subtitle: 'Between 3 km and 5 km away',
  },
  more_options: {
    title: 'More Options Across Prayagraj',
    subtitle: 'More than 5 km away',
  },
};

/**
 * Presentation-layer coordinate privacy:
 * Produces deterministic pseudo-random jitter (~150m to 250m) around canonical coordinates
 * so the exact house address/gate is never rendered publicly on OpenStreetMap.
 * Canonical coordinates in the database/repository remain untouched.
 */
export function getPublicDisplayCoordinates(
  lat: number,
  lng: number,
  saltSeed: string = 'prayag'
): { latitude: number; longitude: number } {
  // Deterministic pseudo-random angle and offset based on coordinate values and salt
  let hash = 0;
  const str = `${lat.toFixed(5)}_${lng.toFixed(5)}_${saltSeed}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  // Offset distance between 150m and 250m (~0.00135 to 0.00225 degrees)
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const offsetMeters = 150 + (Math.abs(hash >> 8) % 100);
  const offsetDegreesLat = offsetMeters / 111000;
  const offsetDegreesLng = offsetMeters / (111000 * Math.cos(toRad(lat)));

  const jitteredLat = lat + offsetDegreesLat * Math.sin(angle);
  const jitteredLng = lng + offsetDegreesLng * Math.cos(angle);

  return {
    latitude: Math.round(jitteredLat * 100000) / 100000,
    longitude: Math.round(jitteredLng * 100000) / 100000,
  };
}

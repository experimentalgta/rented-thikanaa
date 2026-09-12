import { LocationSource } from '../../types';

export interface AccuracyEvaluation {
  accuracyMeters?: number;
  accuracyLabel: string;
  isLowAccuracy: boolean;
  warningMessage?: string;
  source: LocationSource;
}

/**
 * Formats a raw meters accuracy value into user-friendly Indian English text:
 * - "< 1000m": "approximately 35 m"
 * - ">= 1000m": "approximately 1.8 km"
 */
export function formatAccuracy(accuracyMeters?: number): string {
  if (accuracyMeters === undefined || accuracyMeters === null) {
    return 'Unknown accuracy';
  }
  if (accuracyMeters < 1000) {
    return `approximately ${Math.round(accuracyMeters)} m`;
  }
  const km = (accuracyMeters / 1000).toFixed(1);
  return `approximately ${km} km`;
}

/**
 * Evaluates GPS or manual accuracy and produces appropriate guidance:
 * - High accuracy GPS (< 100m)
 * - Moderate accuracy (100m - 500m)
 * - Low accuracy / Desktop IP geolocation (> 500m or > 1000m): warns the user to adjust pin
 * - Manually placed on map: "Location set manually"
 */
export function evaluateLocationAccuracy(
  accuracyMeters?: number,
  source: LocationSource = 'gps'
): AccuracyEvaluation {
  if (source === 'map' || source === 'manual') {
    return {
      accuracyMeters: undefined,
      accuracyLabel: 'Location set manually',
      isLowAccuracy: false,
      source,
    };
  }

  if (source === 'search') {
    return {
      accuracyMeters: undefined,
      accuracyLabel: 'Selected from search',
      isLowAccuracy: false,
      source,
    };
  }

  if (source === 'none') {
    return {
      accuracyMeters: undefined,
      accuracyLabel: 'No location selected',
      isLowAccuracy: false,
      source,
    };
  }

  // Source is GPS:
  const formatted = formatAccuracy(accuracyMeters);

  if (accuracyMeters === undefined || accuracyMeters === null) {
    return {
      accuracyLabel: 'GPS location detected',
      isLowAccuracy: false,
      source: 'gps',
    };
  }

  // High precision (e.g. mobile GPS chip with line of sight)
  if (accuracyMeters <= 100) {
    return {
      accuracyMeters,
      accuracyLabel: `High accuracy GPS (${formatted})`,
      isLowAccuracy: false,
      source: 'gps',
    };
  }

  // Moderate precision (e.g. Wi-Fi positioning)
  if (accuracyMeters <= 500) {
    return {
      accuracyMeters,
      accuracyLabel: `GPS location (${formatted})`,
      isLowAccuracy: false,
      source: 'gps',
    };
  }

  // Low accuracy (e.g. desktop ISP triangulation, cellular tower)
  return {
    accuracyMeters,
    accuracyLabel: `Approximate location (${formatted})`,
    isLowAccuracy: true,
    warningMessage:
      'Your current location may be approximate. Please adjust the pin on the map or search your area manually for better accuracy.',
    source: 'gps',
  };
}

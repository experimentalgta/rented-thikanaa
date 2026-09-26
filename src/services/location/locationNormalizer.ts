import { LocationData, LocationSource, Locality, City, Landmark } from '../../types';
import { ALL_INDIAN_LOCALITIES } from '../../data/indiaLocations';
import { calculateHaversineDistanceKm } from '../../utils/geo';

export interface NominatimAddress {
  house_number?: string;
  house_name?: string;
  building?: string;
  amenity?: string;
  shop?: string;
  office?: string;
  road?: string;
  street?: string;
  suburb?: string;
  neighbourhood?: string;
  neighborhood?: string;
  residential?: string;
  quarter?: string;
  locality?: string;
  commercial?: string;
  industrial?: string;
  city_district?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  'ISO3166-2-lvl4'?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface NominatimPlace {
  place_id?: number | string;
  lat: string | number;
  lon: string | number;
  display_name: string;
  address?: NominatimAddress;
  type?: string;
  importance?: number;
}

/**
 * Checks if a string represents a broad administrative zone, tehsil, ward or district
 * that should not be confused with a specific residential locality/neighborhood.
 */
export function isAdministrativeOrBroadZone(
  name?: string,
  city?: string,
  state?: string,
  district?: string
): boolean {
  if (!name || !name.trim()) return true;
  const lower = name.trim().toLowerCase();
  if (city && lower === city.trim().toLowerCase()) return true;
  if (state && lower === state.trim().toLowerCase()) return true;
  if (district && lower === district.trim().toLowerCase()) return true;

  // Administrative / territorial keywords in India
  if (
    /^(sadar|tehsil|taluk|district|ward|zone\s*\d+|corporation)\b/i.test(lower) ||
    /\s+(tehsil|taluk|district|division|corporation|zone)$/i.test(lower) ||
    /mumbai zone/i.test(lower) ||
    /city corporation/i.test(lower) ||
    /municipal corporation/i.test(lower) ||
    /suburban district/i.test(lower) ||
    /revenue division/i.test(lower)
  ) {
    return true;
  }
  return false;
}

/**
 * Robust locality and city resolution strategy for India:
 * Prioritizes specific neighborhood/colony/quarter over broad administrative zones.
 */
export function resolveLocalityAndCity(addr: NominatimAddress): {
  locality: string;
  localitySlug: string;
  subLocality?: string;
  city: string;
  citySlug: string;
  district: string;
  state: string;
} {
  const district = (addr.state_district || addr.county || '').trim();
  const state = (addr.state || '').trim();

  // 1. Resolve City:
  // Priority: addr.city -> addr.town -> addr.municipality -> district / county
  let city = (addr.city || addr.town || addr.municipality || '').trim();
  if (!city) {
    if (district && !/district|division|zone|corporation|tehsil|taluk/i.test(district)) {
      city = district;
    } else if (addr.county && !/district|division|zone|corporation|tehsil|taluk|sadar/i.test(addr.county)) {
      city = addr.county;
    } else {
      city = state || 'India';
    }
  }

  // 2. Specific neighborhood / colony / quarter candidates:
  const specificNeighborhood = [
    addr.neighbourhood,
    addr.neighborhood,
    addr.residential,
    addr.quarter,
  ]
    .map((s) => s?.trim())
    .find((s) => s && !isAdministrativeOrBroadZone(s, city, state, district));

  // 3. Suburb / Area candidates:
  const suburbArea = [
    addr.suburb,
    addr.locality,
    addr.commercial,
    addr.industrial,
  ]
    .map((s) => s?.trim())
    .find((s) => s && !isAdministrativeOrBroadZone(s, city, state, district));

  // 4. Village / Rural locality candidates:
  const villageArea = [
    addr.village,
    addr.hamlet,
  ]
    .map((s) => s?.trim())
    .find((s) => s && !isAdministrativeOrBroadZone(s, city, state, district));

  let locality = '';
  let subLocality: string | undefined = undefined;

  if (specificNeighborhood && suburbArea && specificNeighborhood.toLowerCase() !== suburbArea.toLowerCase()) {
    locality = `${specificNeighborhood}, ${suburbArea}`;
    subLocality = specificNeighborhood;
  } else if (specificNeighborhood) {
    locality = specificNeighborhood;
  } else if (suburbArea) {
    locality = suburbArea;
  } else if (villageArea) {
    locality = villageArea;
  } else if (addr.city_district && !isAdministrativeOrBroadZone(addr.city_district, city, state, district)) {
    locality = addr.city_district.trim();
  } else if (addr.road && !isAdministrativeOrBroadZone(addr.road, city, state, district)) {
    locality = addr.road.trim();
  } else {
    locality = city;
  }

  return {
    locality,
    localitySlug: locality.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    subLocality,
    city,
    citySlug: city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    district,
    state,
  };
}

/**
 * Natural Indian Address Formatter
 * Priority: House/Building -> Road/Street -> Correct Locality -> City -> State -> PIN code
 */
export function formatIndianAddress(
  addr: NominatimAddress,
  resolvedLocality?: string,
  resolvedCity?: string,
  fallbackDisplayName?: string
): string {
  const premiseParts: string[] = [];
  if (addr.house_number?.trim()) premiseParts.push(addr.house_number.trim());
  if (addr.house_name?.trim() && addr.house_name !== addr.house_number) premiseParts.push(addr.house_name.trim());
  if (addr.building?.trim() && !premiseParts.includes(addr.building.trim())) premiseParts.push(addr.building.trim());
  else if (addr.amenity?.trim() && !premiseParts.includes(addr.amenity.trim())) premiseParts.push(addr.amenity.trim());
  else if (addr.shop?.trim() && !premiseParts.includes(addr.shop.trim())) premiseParts.push(addr.shop.trim());
  else if (addr.office?.trim() && !premiseParts.includes(addr.office.trim())) premiseParts.push(addr.office.trim());

  const road = addr.road?.trim() || addr.street?.trim();
  const locality = resolvedLocality?.trim();
  const city = resolvedCity?.trim();
  const state = addr.state?.trim();
  const pin = addr.postcode?.trim();

  const segments: string[] = [];
  const seen = new Set<string>();

  const addSegment = (val?: string) => {
    if (!val) return;
    const trimmed = val.trim();
    const lower = trimmed.toLowerCase();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      segments.push(trimmed);
    }
  };

  if (premiseParts.length > 0) addSegment(premiseParts.join(', '));
  if (road) addSegment(road);
  if (locality) addSegment(locality);
  if (city && locality && !locality.toLowerCase().includes(city.toLowerCase())) addSegment(city);
  else if (city && !locality) addSegment(city);
  if (state && (!city || !city.toLowerCase().includes(state.toLowerCase()))) addSegment(state);

  if (segments.length === 0) {
    return fallbackDisplayName || '';
  }

  let formatted = segments.join(', ');
  if (pin && /^\d{6}$/.test(pin)) {
    formatted += ` - ${pin}`;
  } else if (pin) {
    formatted += `, ${pin}`;
  }

  return formatted;
}

/**
 * Normalizes OpenStreetMap Nominatim response into Rented Thikan LocationData
 */
export function normalizeNominatimPlace(
  place: NominatimPlace,
  source: LocationSource = 'search'
): LocationData {
  const addr = place.address || {};
  const lat = typeof place.lat === 'string' ? parseFloat(place.lat) : place.lat;
  const lon = typeof place.lon === 'string' ? parseFloat(place.lon) : place.lon;

  const resolved = resolveLocalityAndCity(addr);
  const country = addr.country || 'India';
  const countryCode = (addr.country_code || 'in').toUpperCase();
  const pincode = addr.postcode?.trim();

  const formattedAddress = formatIndianAddress(addr, resolved.locality, resolved.city, place.display_name);

  return {
    country,
    countryCode,
    state: resolved.state,
    stateCode: addr['ISO3166-2-lvl4']?.replace(/^IN-/, '') || undefined,
    district: resolved.district,
    city: resolved.city,
    citySlug: resolved.citySlug,
    locality: resolved.locality,
    localitySlug: resolved.localitySlug,
    subLocality: resolved.subLocality,
    formattedAddress,
    pincode,
    latitude: lat,
    longitude: lon,
    source,
    placeId: place.place_id ? String(place.place_id) : undefined,
  };
}

/**
 * Normalizes Photon / Komoot OpenStreetMap GeoJSON feature into LocationData
 */
export function normalizePhotonFeature(
  feature: any,
  lat: number,
  lon: number,
  source: LocationSource = 'gps'
): LocationData {
  const props = feature?.properties || {};
  const addr: NominatimAddress = {
    road: props.street,
    suburb: props.district,
    city: props.city,
    county: props.county,
    state: props.state,
    postcode: props.postcode,
    country: props.country,
    country_code: props.countrycode,
  };

  const resolved = resolveLocalityAndCity(addr);
  const pincode = props.postcode?.trim();
  const formattedAddress = formatIndianAddress(addr, resolved.locality, resolved.city);

  return {
    country: props.country || 'India',
    countryCode: (props.countrycode || 'IN').toUpperCase(),
    state: resolved.state,
    district: resolved.district,
    city: resolved.city,
    citySlug: resolved.citySlug,
    locality: resolved.locality,
    localitySlug: resolved.localitySlug,
    formattedAddress,
    pincode,
    latitude: lat,
    longitude: lon,
    source,
  };
}

/**
 * Normalizes a local locality catalog entry into LocationData
 */
export function normalizeLocalityToLocationData(
  loc: Locality,
  source: LocationSource = 'search'
): LocationData {
  return {
    country: 'India',
    countryCode: 'IN',
    state: loc.state_name,
    stateCode: loc.state_code,
    district: loc.district || loc.city_name,
    city: loc.city_name,
    citySlug: loc.city_slug,
    locality: loc.name,
    localitySlug: loc.slug,
    formattedAddress: `${loc.name}, ${loc.city_name}, ${loc.state_code}`,
    latitude: loc.latitude,
    longitude: loc.longitude,
    source,
  };
}

/**
 * Normalizes a local city catalog entry into LocationData
 */
export function normalizeCityToLocationData(
  city: City,
  source: LocationSource = 'search'
): LocationData {
  return {
    country: 'India',
    countryCode: 'IN',
    state: city.state_name,
    stateCode: city.state_code,
    district: city.district || city.name,
    city: city.name,
    citySlug: city.slug,
    locality: city.name,
    localitySlug: city.slug,
    formattedAddress: `${city.name}, ${city.state_name}`,
    latitude: city.latitude,
    longitude: city.longitude,
    source,
  };
}

/**
 * Normalizes a local landmark into LocationData
 */
export function normalizeLandmarkToLocationData(
  lm: Landmark,
  stateName?: string,
  source: LocationSource = 'search'
): LocationData {
  return {
    country: 'India',
    countryCode: 'IN',
    state: stateName || 'India',
    city: lm.city_name,
    citySlug: lm.city_slug,
    locality: lm.locality,
    landmark: lm.short_name || lm.name,
    formattedAddress: `${lm.short_name || lm.name} (${lm.locality}, ${lm.city_name})`,
    latitude: lm.latitude,
    longitude: lm.longitude,
    source,
  };
}

export interface RefinedLocalityResult {
  locality: string;
  localitySlug: string;
  city?: string;
  isSnapped: boolean;
}

/**
 * High-accuracy locality resolution & proximity snapping:
 * Resolves discrepancies where third-party geocoders return broad municipal zones (e.g. "Chowk")
 * when user is actually residing in a specific neighborhood (e.g. "Kydganj (Khaadganj)").
 */
export function snapToAccurateLocality(
  latitude: number,
  longitude: number,
  cityName?: string,
  rawResolvedLocality?: string,
  rawAddressText?: string
): RefinedLocalityResult {
  if (!latitude || !longitude) {
    return {
      locality: rawResolvedLocality || '',
      localitySlug: (rawResolvedLocality || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      isSnapped: false,
    };
  }

  const combinedText = `${rawResolvedLocality || ''} ${rawAddressText || ''}`.toLowerCase();

  // Filter candidates by city if specified, or all within reasonable distance
  let candidates = ALL_INDIAN_LOCALITIES;
  if (cityName) {
    const cleanCity = cityName.trim().toLowerCase();
    const cityMatches = ALL_INDIAN_LOCALITIES.filter(
      (l) => l.city_name.toLowerCase() === cleanCity || l.city_slug === cleanCity
    );
    if (cityMatches.length > 0) {
      candidates = cityMatches;
    }
  }

  // 1. Text-based alias match (if address text contains known neighborhood within 5km)
  for (const loc of candidates) {
    const dist = calculateHaversineDistanceKm(latitude, longitude, loc.latitude, loc.longitude);
    if (dist <= 5.0) {
      const namesToCheck = [loc.name, loc.slug, ...(loc.aliases || [])];
      for (const name of namesToCheck) {
        if (name && name.length >= 3 && combinedText.includes(name.toLowerCase())) {
          return {
            locality: loc.name,
            localitySlug: loc.slug,
            city: loc.city_name,
            isSnapped: true,
          };
        }
      }
    }
  }

  // 2. High-precision nearest neighbor snapping:
  let closestLocality = candidates[0];
  let minDistanceKm = 999999;

  for (const loc of candidates) {
    const dist = calculateHaversineDistanceKm(latitude, longitude, loc.latitude, loc.longitude);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      closestLocality = loc;
    }
  }

  // If user is within 2.5km of a verified locality in our catalog:
  if (closestLocality && minDistanceKm <= 2.5) {
    return {
      locality: closestLocality.name,
      localitySlug: closestLocality.slug,
      city: closestLocality.city_name,
      isSnapped: true,
    };
  }

  return {
    locality: rawResolvedLocality || closestLocality?.name || '',
    localitySlug: (rawResolvedLocality || closestLocality?.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    city: closestLocality?.city_name,
    isSnapped: false,
  };
}

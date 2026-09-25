import { LocationData, LocationSource, Locality, City, Landmark } from '../../types';

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
  residential?: string;
  quarter?: string;
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
 * Natural Indian Address Formatter
 * Priority: House/Building -> Road/Street -> Area/Colony -> Suburb/Locality -> City -> State -> PIN code
 */
export function formatIndianAddress(addr: NominatimAddress, fallbackDisplayName?: string): string {
  const premiseParts: string[] = [];
  if (addr.house_number?.trim()) premiseParts.push(addr.house_number.trim());
  if (addr.house_name?.trim() && addr.house_name !== addr.house_number) premiseParts.push(addr.house_name.trim());
  if (addr.building?.trim() && !premiseParts.includes(addr.building.trim())) premiseParts.push(addr.building.trim());
  else if (addr.amenity?.trim() && !premiseParts.includes(addr.amenity.trim())) premiseParts.push(addr.amenity.trim());
  else if (addr.shop?.trim() && !premiseParts.includes(addr.shop.trim())) premiseParts.push(addr.shop.trim());
  else if (addr.office?.trim() && !premiseParts.includes(addr.office.trim())) premiseParts.push(addr.office.trim());

  const road = addr.road?.trim() || addr.street?.trim();
  const area = addr.neighbourhood?.trim() || addr.residential?.trim() || addr.quarter?.trim();
  const locality = addr.suburb?.trim() || addr.city_district?.trim() || addr.village?.trim() || addr.hamlet?.trim();
  const city = addr.city?.trim() || addr.town?.trim() || addr.municipality?.trim() || addr.county?.trim();
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
  if (area) addSegment(area);
  if (locality) addSegment(locality);
  if (city) addSegment(city);
  if (state) addSegment(state);

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

  // Extract locality (neighborhood / suburb)
  const locality =
    addr.suburb ||
    addr.neighbourhood ||
    addr.residential ||
    addr.quarter ||
    addr.city_district ||
    addr.village ||
    addr.hamlet ||
    addr.town ||
    addr.city ||
    '';

  // Extract city
  const city =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.county ||
    locality;

  // Extract district
  const district =
    addr.state_district ||
    addr.county ||
    city;

  const state = addr.state || '';
  const country = addr.country || 'India';
  const countryCode = (addr.country_code || 'in').toUpperCase();
  const pincode = addr.postcode?.trim();

  const formattedAddress = formatIndianAddress(addr, place.display_name);

  return {
    country,
    countryCode,
    state,
    stateCode: addr['ISO3166-2-lvl4']?.replace(/^IN-/, '') || undefined,
    district,
    city,
    citySlug: city ? city.toLowerCase().replace(/\s+/g, '-') : undefined,
    locality,
    localitySlug: locality ? locality.toLowerCase().replace(/\s+/g, '-') : undefined,
    subLocality: addr.neighbourhood && addr.suburb && addr.neighbourhood !== addr.suburb ? addr.neighbourhood : undefined,
    formattedAddress,
    pincode,
    latitude: lat,
    longitude: lon,
    source,
    placeId: place.place_id ? String(place.place_id) : undefined,
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

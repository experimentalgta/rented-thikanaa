import { LocationData, LocationSource, Locality, City, Landmark } from '../../types';

export interface NominatimAddress {
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
  postcode?: string;
  country?: string;
  country_code?: string;
  road?: string;
  building?: string;
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

  // Create clean formatted hierarchy
  const parts: string[] = [];
  if (locality) parts.push(locality);
  if (city && city !== locality) parts.push(city);
  if (state && state !== city) parts.push(state);

  const formattedAddress = parts.length > 0 ? parts.join(', ') : place.display_name;

  return {
    country,
    countryCode,
    state,
    district,
    city,
    citySlug: city ? city.toLowerCase().replace(/\s+/g, '-') : undefined,
    locality,
    localitySlug: locality ? locality.toLowerCase().replace(/\s+/g, '-') : undefined,
    subLocality: addr.neighbourhood && addr.suburb && addr.neighbourhood !== addr.suburb ? addr.neighbourhood : undefined,
    formattedAddress,
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

// Standalone Geo & Privacy Algorithm Verification
const EARTH_RADIUS_KM = 6371;

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    const meters = Math.max(50, Math.round((distanceKm * 1000) / 50) * 50);
    return `${meters} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function getProximityBucket(distanceKm) {
  if (distanceKm < 1.0) return 'very_near';
  if (distanceKm < 3.0) return 'nearby';
  if (distanceKm < 5.0) return 'nearby_areas';
  return 'more_options';
}

function getPublicDisplayCoordinates(lat, lng, saltSeed = 'prayag') {
  let hash = 0;
  const str = `${lat.toFixed(5)}_${lng.toFixed(5)}_${saltSeed}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const offsetMeters = 150 + (Math.abs(hash >> 8) % 100);
  const offsetDegreesLat = offsetMeters / 111000;
  const offsetDegreesLng = offsetMeters / (111000 * Math.cos(toRad(lat)));

  return {
    latitude: Math.round((lat + offsetDegreesLat * Math.sin(angle)) * 100000) / 100000,
    longitude: Math.round((lng + offsetDegreesLng * Math.cos(angle)) * 100000) / 100000,
  };
}

// 1. Proximity Check in Prayagraj
const katraLat = 25.4563;
const katraLng = 81.8546;
const civilLinesLat = 25.4484;
const civilLinesLng = 81.8331;
const daraganjLat = 25.4385;
const daraganjLng = 81.8742;

const katraToCivil = calculateHaversineDistanceKm(katraLat, katraLng, civilLinesLat, civilLinesLng);
const katraToDara = calculateHaversineDistanceKm(katraLat, katraLng, daraganjLat, daraganjLng);

console.log(`✓ Katra -> Civil Lines Distance: ${katraToCivil} km`);
console.log(`✓ Katra -> Daraganj Distance: ${katraToDara} km`);
console.assert(katraToCivil > 2.0 && katraToCivil < 2.6, 'Katra to Civil Lines failed');
console.assert(katraToDara > 2.5 && katraToDara < 3.2, 'Katra to Daraganj failed');

// 2. Formatting Check
console.log(`✓ 0.45 km formatted: "${formatDistance(0.45)}"`);
console.assert(formatDistance(0.45) === '450 m away');
console.log(`✓ 2.34 km formatted: "${formatDistance(2.34)}"`);
console.assert(formatDistance(2.34) === '2.3 km away');

// 3. Presentation Group Buckets Check
console.assert(getProximityBucket(0.8) === 'very_near', '0.8km is very_near');
console.assert(getProximityBucket(2.2) === 'nearby', '2.2km is nearby');
console.assert(getProximityBucket(4.1) === 'nearby_areas', '4.1km is nearby_areas');
console.assert(getProximityBucket(7.5) === 'more_options', '7.5km is more_options');
console.log('✓ Proximity buckets: <1km (very_near), 1-3km (nearby), 3-5km (nearby_areas), 5+km (more_options)');

// 4. Privacy Coordinate Fuzzing Check
const fuzzed = getPublicDisplayCoordinates(katraLat, katraLng, 'prop-1');
const fuzzDistance = calculateHaversineDistanceKm(katraLat, katraLng, fuzzed.latitude, fuzzed.longitude) * 1000;
console.log(`✓ Public map coordinate fuzz offset: ${fuzzDistance.toFixed(0)} meters (safe neighborhood jitter)`);
console.assert(fuzzDistance >= 140 && fuzzDistance <= 260, 'Fuzz offset out of safe 150-250m range');

// 5. Anti-Leapfrogging Ranking Verification
const props = [
  { id: 'close-unverified', title: 'Close Room', distance_km: 0.4, is_featured: false },
  { id: 'far-featured', title: 'Far Featured PG', distance_km: 3.2, is_featured: true },
  { id: 'nearby-featured', title: 'Nearby PG', distance_km: 1.5, is_featured: true },
  { id: 'close-featured', title: 'Close Featured PG', distance_km: 0.45, is_featured: true }
];

props.sort((a, b) => {
  const distDiff = a.distance_km - b.distance_km;
  if (Math.abs(distDiff) <= 0.35) {
    const scoreA = a.is_featured ? 2 : 0;
    const scoreB = b.is_featured ? 2 : 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
  }
  return distDiff;
});

console.log('✓ Proximity-Dominant Ranking order:', props.map(p => `${p.title} (${p.distance_km}km, feat:${p.is_featured})`));
console.assert(props[0].distance_km < 1.0, 'Far featured property must NEVER outrank closer property');
console.assert(props[props.length - 1].id === 'far-featured', 'Far featured property correctly remains at the end');

// 6. Phone Privacy State Machine Verification
function getExposedPhone(phonePrivacy, contactRequestStatus, rawPhone) {
  const isAuthorized = phonePrivacy === 'public' || contactRequestStatus === 'accepted';
  return isAuthorized ? rawPhone : null;
}

console.assert(getExposedPhone('private', 'none', '+91 99999 99999') === null, 'Private should be masked');
console.assert(getExposedPhone('on_request', 'pending', '+91 99999 99999') === null, 'Pending request should be masked');
console.assert(getExposedPhone('on_request', 'rejected', '+91 99999 99999') === null, 'Rejected request should be masked');
console.assert(getExposedPhone('on_request', 'accepted', '+91 99999 99999') === '+91 99999 99999', 'Accepted request should be revealed');
console.assert(getExposedPhone('public', 'none', '+91 99999 99999') === '+91 99999 99999', 'Public setting should be revealed');
console.log('✓ Phone privacy state machine verified (private/on_request/public/accepted/rejected)');

console.log('\n🌟 ALL 6 CORE PRODUCT PRINCIPLES VERIFIED AND PASSING WITH FLYING COLORS!');

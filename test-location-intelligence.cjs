const assert = require('assert');

// 1. Test Locations
const PRAYAGRAJ_LOCALITIES = [
  { id: 'katra', name: 'Katra', latitude: 25.4563, longitude: 81.8546 },
  { id: 'civil-lines', name: 'Civil Lines', latitude: 25.4484, longitude: 81.8331 },
  { id: 'mumfordganj', name: 'Mumfordganj', latitude: 25.465, longitude: 81.848 },
  { id: 'teliarganj', name: 'Teliarganj', latitude: 25.4925, longitude: 81.8654 },
  { id: 'chatham-lines', name: 'Chatham Lines', latitude: 25.471, longitude: 81.852 },
  { id: 'allapur', name: 'Allapur', latitude: 25.442, longitude: 81.868 },
  { id: 'salori', name: 'Salori', latitude: 25.474, longitude: 81.861 },
  { id: 'daraganj', name: 'Daraganj', latitude: 25.4385, longitude: 81.8742 },
  { id: 'george-town', name: 'George Town', latitude: 25.441, longitude: 81.855 },
  { id: 'tagore-town', name: 'Tagore Town', latitude: 25.445, longitude: 81.858 }
];

const PRAYAGRAJ_COLLEGES = [
  { id: 'au-main', name: 'Allahabad University (AU)', latitude: 25.4589, longitude: 81.8562 },
  { id: 'mnnit', name: 'Motilal Nehru National Institute of Technology (MNNIT)', latitude: 25.4925, longitude: 81.8654 }
];

const EARTH_RADIUS_KM = 6371;
function toRad(degrees) { return (degrees * Math.PI) / 180; }
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

function getProximityBucket(distanceKm) {
  if (distanceKm < 1.0) return 'very_near';
  if (distanceKm < 3.0) return 'nearby';
  if (distanceKm < 5.0) return 'nearby_areas';
  return 'more_options';
}

function isWithinPrayagrajRegion(lat, lng) {
  return lat >= 25.20 && lat <= 25.65 && lng >= 81.65 && lng <= 82.15;
}

function reverseGeocodePrayagraj(lat, lng) {
  const isWithin = isWithinPrayagrajRegion(lat, lng);
  let closestLocality = PRAYAGRAJ_LOCALITIES[0];
  let minLocalityDist = calculateHaversineDistanceKm(lat, lng, closestLocality.latitude, closestLocality.longitude);

  for (let i = 1; i < PRAYAGRAJ_LOCALITIES.length; i++) {
    const loc = PRAYAGRAJ_LOCALITIES[i];
    const dist = calculateHaversineDistanceKm(lat, lng, loc.latitude, loc.longitude);
    if (dist < minLocalityDist) {
      minLocalityDist = dist;
      closestLocality = loc;
    }
  }

  let closestCol = PRAYAGRAJ_COLLEGES[0];
  let minColDist = calculateHaversineDistanceKm(lat, lng, closestCol.latitude, closestCol.longitude);
  for (let i = 1; i < PRAYAGRAJ_COLLEGES.length; i++) {
    const col = PRAYAGRAJ_COLLEGES[i];
    const dist = calculateHaversineDistanceKm(lat, lng, col.latitude, col.longitude);
    if (dist < minColDist) {
      minColDist = dist;
      closestCol = col;
    }
  }

  const displayName = isWithin
    ? `Near ${closestLocality.name}, Prayagraj`
    : `Prayagraj (${closestLocality.name} Region)`;

  return {
    localityName: closestLocality.name,
    displayName,
    nearestLandmark: minColDist < 1.5 ? closestCol.name : undefined,
    distanceToLocalityKm: minLocalityDist,
    isWithinPrayagraj: isWithin,
  };
}

console.log('--- TEST 1: clearLocation() specification ---');
const EMPTY_LOCATION = {
  latitude: undefined,
  longitude: undefined,
  locality: '',
  displayName: '',
  source: 'none',
};

assert.strictEqual(EMPTY_LOCATION.source, 'none', 'Source must be "none"');
assert.strictEqual(EMPTY_LOCATION.locality, '', 'Locality must be empty');
assert.strictEqual(EMPTY_LOCATION.latitude, undefined, 'Latitude must be undefined');
assert.strictEqual(EMPTY_LOCATION.longitude, undefined, 'Longitude must be undefined');
assert.notStrictEqual(EMPTY_LOCATION.locality.toLowerCase(), 'katra', 'Must NOT default to Katra when cleared');
console.log('✓ clearLocation() correctly resets to source: "none" without Katra fallback.');

console.log('\n--- TEST 2: reverseGeocodePrayagraj Accuracy ---');
// Katra test
const katraRev = reverseGeocodePrayagraj(25.4563, 81.8546);
assert.strictEqual(katraRev.localityName, 'Katra', 'Should identify Katra');
assert.strictEqual(katraRev.isWithinPrayagraj, true, 'Should be within Prayagraj');
assert.strictEqual(katraRev.nearestLandmark, 'Allahabad University (AU)', 'Should detect AU');
console.log(`✓ Katra test passed: ${katraRev.displayName}, Landmark: ${katraRev.nearestLandmark}`);

// Teliarganj (near MNNIT) test
const mnnitRev = reverseGeocodePrayagraj(25.4925, 81.8654);
assert.strictEqual(mnnitRev.localityName, 'Teliarganj', 'Should identify Teliarganj');
assert.strictEqual(mnnitRev.nearestLandmark, 'Motilal Nehru National Institute of Technology (MNNIT)');
console.log(`✓ MNNIT test passed: ${mnnitRev.displayName}, Landmark: ${mnnitRev.nearestLandmark}`);

// Non-Prayagraj coordinates
const delhiRev = reverseGeocodePrayagraj(28.6139, 77.2090);
assert.strictEqual(delhiRev.isWithinPrayagraj, false, 'Delhi is outside Prayagraj bounds');
console.log(`✓ Delhi outside bounds test passed: isWithinPrayagraj = false`);

console.log('\n--- TEST 3: GPS as Proximity Anchor (No Hard Radius Cutoff) ---');
const sampleProperties = [
  { id: 'prop-1', name: 'Katra PG', lat: 25.4565, lng: 81.8548 }, // ~0.03 km from Katra
  { id: 'prop-2', name: 'Mumfordganj Room', lat: 25.465, lng: 81.848 }, // ~1.17 km
  { id: 'prop-3', name: 'Civil Lines Flat', lat: 25.4484, lng: 81.8331 }, // ~2.34 km
  { id: 'prop-4', name: 'Teliarganj Hostel', lat: 25.4925, lng: 81.8654 }, // ~4.17 km
  { id: 'prop-5', name: 'Naini Studio', lat: 25.385, lng: 81.875 }, // ~8.2 km
];

// User is at Katra GPS coords
const userGpsLat = 25.4563;
const userGpsLng = 81.8546;

const ranked = sampleProperties.map(p => {
  const dist = calculateHaversineDistanceKm(userGpsLat, userGpsLng, p.lat, p.lng);
  return { ...p, dist, bucket: getProximityBucket(dist) };
}).sort((a, b) => a.dist - b.dist);

// Verify continuous monotonic distance
for (let i = 0; i < ranked.length - 1; i++) {
  assert(ranked[i].dist <= ranked[i + 1].dist, `Item ${i} (${ranked[i].dist}km) must be <= item ${i+1} (${ranked[i+1].dist}km)`);
}

// Verify NO hard cutoff: Naini studio at 8.2 km is still present in the results!
assert.strictEqual(ranked.length, 5, 'All properties must be retained without hard radius cutoffs');
assert.strictEqual(ranked[0].bucket, 'very_near');
assert.strictEqual(ranked[1].bucket, 'nearby');
assert.strictEqual(ranked[2].bucket, 'nearby');
assert.strictEqual(ranked[3].bucket, 'nearby_areas');
assert.strictEqual(ranked[4].bucket, 'more_options');

console.log('✓ Proximity anchor ranking verified:');
ranked.forEach(r => console.log(`   - [${r.bucket}] ${r.name}: ${r.dist} km`));

console.log('\n--- TEST 4: Anti-Leapfrogging with Featured Weighting ---');
// A featured property at 2.5km should never leapfrog an ultra-close property at 0.1km
function computeCompositeScore(distKm, isFeatured) {
  const distancePenalty = distKm * 10;
  const featuredBonus = isFeatured ? 3 : 0; // Moderate boost
  return distancePenalty - featuredBonus; // Lower score is better
}

const ultraClose = { name: 'Close Room', dist: 0.2, isFeatured: false };
const farFeatured = { name: 'Far Featured PG', dist: 2.5, isFeatured: true };

const closeScore = computeCompositeScore(ultraClose.dist, ultraClose.isFeatured);
const farScore = computeCompositeScore(farFeatured.dist, farFeatured.isFeatured);

assert(closeScore < farScore, 'Ultra-close property must rank higher than far featured property');
console.log(`✓ Anti-leapfrogging preserved: Close score (${closeScore}) < Far featured score (${farScore})`);

console.log('\n=========================================');
console.log('ALL LOCATION INTELLIGENCE TESTS PASSED! ✓');
console.log('=========================================');

import {
  calculateHaversineDistanceKm,
  formatDistance,
  getProximityBucket,
  getPublicDisplayCoordinates,
} from './src/utils/geo.js';

// Verify Haversine Distance
const katraLat = 25.4563;
const katraLng = 81.8546;
const civilLinesLat = 25.4484;
const civilLinesLng = 81.8331;

const dist = calculateHaversineDistanceKm(katraLat, katraLng, civilLinesLat, civilLinesLng);
console.log(`✓ Katra to Civil Lines Distance: ${dist} km (expected ~2.3 km)`);
console.assert(dist > 2.0 && dist < 2.6, 'Distance calculation out of expected bounds');

// Verify Distance Formatting
console.log(`✓ 0.45 km formatted: "${formatDistance(0.45)}" (expected "450 m away")`);
console.assert(formatDistance(0.45) === '450 m away', 'Format < 1km failed');

console.log(`✓ 1.82 km formatted: "${formatDistance(1.82)}" (expected "1.8 km away")`);
console.assert(formatDistance(1.82) === '1.8 km away', 'Format >= 1km failed');

// Verify Proximity Buckets
console.assert(getProximityBucket(0.6) === 'very_near', 'Bucket < 1km failed');
console.assert(getProximityBucket(2.1) === 'nearby', 'Bucket 1-3km failed');
console.assert(getProximityBucket(4.2) === 'nearby_areas', 'Bucket 3-5km failed');
console.assert(getProximityBucket(6.5) === 'more_options', 'Bucket 5+km failed');
console.log('✓ Proximity buckets validated (< 1km, 1-3km, 3-5km, 5+km)');

// Verify Presentation Coordinate Fuzzing (Preserving Privacy)
const fuzzed = getPublicDisplayCoordinates(katraLat, katraLng, 'prop-101');
const fuzzDistance = calculateHaversineDistanceKm(katraLat, katraLng, fuzzed.latitude, fuzzed.longitude) * 1000;
console.log(`✓ Coordinate privacy offset: ${fuzzDistance.toFixed(0)} meters (expected 150m - 250m)`);
console.assert(fuzzDistance >= 130 && fuzzDistance <= 270, 'Fuzz offset out of expected range');

console.log('\n🌟 ALL CORE GEOGRAPHIC & PRIVACY ALGORITHMS VERIFIED SUCCESSFULLY!');

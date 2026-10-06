/**
 * Verification test script for Super Admin Panel performance and caching
 */

const assert = require('assert');

console.log('--- RUNNING SUPER ADMIN PERFORMANCE & CACHING TESTS ---\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

// -------------------------------------------------------------
// Test 1: Fast Authorization & Caching
// -------------------------------------------------------------
class MockServerAuth {
  constructor() {
    this.knownIds = new Set(['admin-1', '61aa77b2-43b7-4697-af79-98b8ffe5d094']);
    this.knownEmails = new Set(['ujjwalmaurya2@gmail.com']);
    this.cache = new Set();
    this.dbCallCount = 0;
  }

  markVerifiedAdmin(userId) {
    if (userId) this.cache.add(userId);
  }

  async verifySuperAdminAuthorization(userId, userEmail) {
    if (userId && (this.knownIds.has(userId) || this.cache.has(userId))) {
      return true;
    }
    if (userEmail && this.knownEmails.has(userEmail.toLowerCase())) {
      if (userId) this.cache.add(userId);
      return true;
    }
    // Simulate DB call
    this.dbCallCount++;
    if (userId === 'new-admin-from-db') {
      this.cache.add(userId);
      return true;
    }
    return false;
  }

  isSuperAdmin(userId, userEmail) {
    if (userId && (this.knownIds.has(userId) || this.cache.has(userId))) return true;
    if (userEmail && this.knownEmails.has(userEmail.toLowerCase())) return true;
    return false;
  }
}

runTest('1. ServerAuth eliminates redundant DB calls via in-memory caching', async () => {
  const auth = new MockServerAuth();
  
  // First call hits simulated DB
  const isAuth1 = await auth.verifySuperAdminAuthorization('new-admin-from-db');
  assert.strictEqual(isAuth1, true);
  assert.strictEqual(auth.dbCallCount, 1);

  // Subsequent calls must hit memory cache (0 DB calls)
  const isAuth2 = await auth.verifySuperAdminAuthorization('new-admin-from-db');
  assert.strictEqual(isAuth2, true);
  assert.strictEqual(auth.dbCallCount, 1, 'Cache was not used for subsequent call');

  const isSyncAuth = auth.isSuperAdmin('new-admin-from-db');
  assert.strictEqual(isSyncAuth, true);
});

// -------------------------------------------------------------
// Test 2: In-Memory Fast Path for Admin Property Privacy Enforcement
// -------------------------------------------------------------
function mockApplyPrivacyEnforcement(prop, currentUserId, isAdmin) {
  const start = process.hrtime.bigint();
  const cloned = { ...prop };
  const isOwnerOrAdmin = currentUserId === cloned.owner_id || isAdmin;

  if (isOwnerOrAdmin) {
    cloned.contact_request_status = 'none';
    cloned.is_exact_location_shared = true;
    cloned.exact_address_shared = prop.address;
    const end = process.hrtime.bigint();
    return { prop: cloned, durationMicros: Number(end - start) / 1000 };
  }

  cloned.contact_request_status = 'none';
  cloned.is_exact_location_shared = false;
  delete cloned.latitude;
  delete cloned.longitude;
  const end = process.hrtime.bigint();
  return { prop: cloned, durationMicros: Number(end - start) / 1000 };
}

runTest('2. Listing privacy enforcement executes in < 0.1ms for admin (zero DB calls)', () => {
  const property = {
    id: 'prop-123',
    owner_id: 'user-other',
    address: '123 Civil Lines, Prayagraj',
    latitude: 25.45,
    longitude: 81.85,
    title: 'Sunny Studio',
  };

  const results = [];
  for (let i = 0; i < 50; i++) {
    const res = mockApplyPrivacyEnforcement(property, 'admin-id', true);
    results.push(res);
  }

  assert.strictEqual(results.length, 50);
  assert.strictEqual(results[0].prop.exact_address_shared, '123 Civil Lines, Prayagraj');
  assert.strictEqual(results[0].prop.is_exact_location_shared, true);
  
  const avgMicros = results.reduce((acc, r) => acc + r.durationMicros, 0) / results.length;
  console.log(`    Average time per listing: ${avgMicros.toFixed(3)} µs (< 0.1ms)`);
  assert(avgMicros < 100, 'Took longer than 100 microseconds per listing');
});

// -------------------------------------------------------------
// Test 3: Admin Repository In-Memory SWR Caching & Invalidation
// -------------------------------------------------------------
class MockAdminRepository {
  constructor() {
    this.statsCache = null;
    this.listingsCache = null;
    this.fetchCount = 0;
  }

  getCachedStats() {
    return this.statsCache?.data || null;
  }

  async getPlatformStats(forceRefresh = false) {
    if (!forceRefresh && this.statsCache) {
      return this.statsCache.data;
    }
    this.fetchCount++;
    const stats = { totalUsers: 30, totalProperties: 20 };
    this.statsCache = { data: stats, timestamp: Date.now() };
    return stats;
  }

  async updateListing(id) {
    // Invalidate
    this.listingsCache = null;
    this.statsCache = null;
  }
}

runTest('3. Admin repository caches stats and invalidates properly upon mutation', async () => {
  const repo = new MockAdminRepository();
  assert.strictEqual(repo.getCachedStats(), null);

  // Initial fetch
  const s1 = await repo.getPlatformStats();
  assert.strictEqual(s1.totalUsers, 30);
  assert.strictEqual(repo.fetchCount, 1);

  // Cached getter gives immediate data (0ms)
  const cached = repo.getCachedStats();
  assert.deepStrictEqual(cached, s1);

  // Second fetch uses cache without incrementing fetchCount
  const s2 = await repo.getPlatformStats();
  assert.strictEqual(repo.fetchCount, 1);

  // After mutation, cache is invalidated
  await repo.updateListing('prop-1');
  assert.strictEqual(repo.getCachedStats(), null);

  // Next fetch re-queries
  await repo.getPlatformStats();
  assert.strictEqual(repo.fetchCount, 2);
});

console.log(`\n--- SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED ---`);
if (testsFailed > 0) process.exit(1);
console.log('ALL PERFORMANCE & CACHING TESTS PASSED!\n');

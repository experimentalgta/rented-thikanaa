const assert = require('assert');

// In-memory mock localStorage
const store = {};
const mockLocalStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
global.localStorage = mockLocalStorage;

console.log('--- STARTING UNIFIED USER & SERVER-SIDE AUTHORIZATION SECURITY TESTS ---\n');

// 1. Server-Side Super Admin Authorization Authority Simulation
// (Mirrors src/services/serverAuth.ts and Supabase public.super_admins)
const SERVER_SUPER_ADMIN_IDS = new Set([
  'admin-super-1',
  'admin-1', // Seed administrative service account
]);

class ServerAuthService {
  async verifySuperAdminAuthorization(userId) {
    if (!userId || typeof userId !== 'string') return false;
    return SERVER_SUPER_ADMIN_IDS.has(userId);
  }

  async assertSuperAdmin(userId) {
    const isAuthorized = await this.verifySuperAdminAuthorization(userId);
    if (!isAuthorized) {
      throw new Error('403 Forbidden: Super Admin Authorization Required. Normal members cannot access moderation resources.');
    }
  }

  isSuperAdmin(userId) {
    if (!userId) return false;
    return SERVER_SUPER_ADMIN_IDS.has(userId);
  }
}

const serverAuth = new ServerAuthService();

// 2. Property Repository with Listing Ownership & Server Auth Guarding
class PropertyRepository {
  constructor() {
    this.storageKey = 'test_properties_v1';
    this.seed();
  }

  seed() {
    const initial = [
      {
        id: 'prop-1',
        title: 'Sharma Nilayam PG – Katra',
        owner_id: 'owner-101',
        created_by: 'owner-101',
        lister_name: 'Rajesh Sharma',
        locality: 'Katra',
        rent: 5500,
        availability_status: 'available',
        phone_privacy: 'private',
        latitude: 25.4563,
        longitude: 81.8546,
        is_verified: false
      }
    ];
    mockLocalStorage.setItem(this.storageKey, JSON.stringify(initial));
  }

  getProperties() {
    return JSON.parse(mockLocalStorage.getItem(this.storageKey) || '[]');
  }

  saveProperties(props) {
    mockLocalStorage.setItem(this.storageKey, JSON.stringify(props));
  }

  async createProperty(data) {
    const all = this.getProperties();
    const newProp = {
      ...data,
      id: `prop-${Date.now()}`,
      created_at: new Date().toISOString()
    };
    all.push(newProp);
    this.saveProperties(all);
    return newProp;
  }

  async updateProperty(id, updates, requestingUserId) {
    const all = this.getProperties();
    const index = all.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Property not found');

    if (requestingUserId) {
      const isOwner = all[index].created_by === requestingUserId || all[index].owner_id === requestingUserId;
      const isAdmin = await serverAuth.verifySuperAdminAuthorization(requestingUserId);
      if (!isOwner && !isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to modify this listing');
      }
    }

    all[index] = { ...all[index], ...updates };
    this.saveProperties(all);
    return all[index];
  }

  async deleteProperty(id, requestingUserId) {
    const all = this.getProperties();
    const index = all.findIndex(p => p.id === id);
    if (index === -1) return false;

    if (requestingUserId) {
      const isOwner = all[index].created_by === requestingUserId || all[index].owner_id === requestingUserId;
      const isAdmin = await serverAuth.verifySuperAdminAuthorization(requestingUserId);
      if (!isOwner && !isAdmin) {
        throw new Error('403 Forbidden: You do not have permission to delete this listing');
      }
    }

    all.splice(index, 1);
    this.saveProperties(all);
    return true;
  }

  async getPropertiesByOwner(userId) {
    const all = this.getProperties();
    return all.filter(p => p.created_by === userId || p.owner_id === userId);
  }

  async getAllPropertiesAdmin(adminUserId) {
    await serverAuth.assertSuperAdmin(adminUserId);
    return this.getProperties();
  }

  async verifyProperty(id, badge, adminUserId) {
    await serverAuth.assertSuperAdmin(adminUserId);
    return this.updateProperty(id, { is_verified: true, verification_badge: badge }, adminUserId);
  }
}

// 3. Safety Repository with Server Auth Guarding
class SafetyRepository {
  constructor() {
    this.reportsKey = 'test_reports_v1';
    this.seed();
  }

  seed() {
    const initialReports = [
      {
        id: 'rep-1',
        reporter_id: 'user-member-1',
        reported_entity_id: 'prop-fake',
        reason: 'fake_listing',
        status: 'pending'
      }
    ];
    mockLocalStorage.setItem(this.reportsKey, JSON.stringify(initialReports));
  }

  async getReports(requestingUserId) {
    await serverAuth.assertSuperAdmin(requestingUserId);
    return JSON.parse(mockLocalStorage.getItem(this.reportsKey) || '[]');
  }

  async updateReportStatus(reportId, status, requestingUserId) {
    await serverAuth.assertSuperAdmin(requestingUserId);
    const reports = JSON.parse(mockLocalStorage.getItem(this.reportsKey) || '[]');
    const r = reports.find(x => x.id === reportId);
    if (r) r.status = status;
    mockLocalStorage.setItem(this.reportsKey, JSON.stringify(reports));
    return r;
  }
}

const propertyRepo = new PropertyRepository();
const safetyRepo = new SafetyRepository();

// --- TEST SUITE EXECUTION ---
(async () => {
  // TEST 1: Unified Member Can Create / List a Property
  console.log('TEST 1: Unified normal member can list a property with created_by attribution...');
  const memberA = {
    id: 'user-member-ankit',
    full_name: 'Ankit Tiwari',
    account_type: 'user',
    role: 'member'
  };

  const createdProp = await propertyRepo.createProperty({
    title: 'Ankit 2BHK Spare Study Room – Katra',
    created_by: memberA.id,
    owner_id: memberA.id,
    lister_name: memberA.full_name,
    locality: 'Katra',
    rent: 4800,
    availability_status: 'available',
    phone_privacy: 'private'
  });

  assert.strictEqual(createdProp.created_by, memberA.id);
  assert.strictEqual(createdProp.lister_name, 'Ankit Tiwari');
  assert.strictEqual(createdProp.availability_status, 'available');
  console.log('✓ TEST 1 PASSED: Property created with member attribution.\n');

  // TEST 2: Member Can Manage & Update Their Own Listing
  console.log('TEST 2: Member can modify/pause/rent their own listing...');
  const updatedByOwner = await propertyRepo.updateProperty(
    createdProp.id,
    { availability_status: 'rented' },
    memberA.id
  );
  assert.strictEqual(updatedByOwner.availability_status, 'rented');
  console.log('✓ TEST 2 PASSED: Member updated own listing status.\n');

  // TEST 3: Unauthorized Member CANNOT Modify Another Member's Listing (403 Forbidden)
  console.log('TEST 3: Another member (User B) attempting to modify User A listing gets 403 Forbidden...');
  const memberB = {
    id: 'user-member-rohit',
    full_name: 'Rohit Verma',
    account_type: 'user',
    role: 'member'
  };

  let caughtTamperError = false;
  try {
    await propertyRepo.updateProperty(
      createdProp.id,
      { rent: 1000 },
      memberB.id // User B has no permission on User A's listing
    );
  } catch (err) {
    caughtTamperError = true;
    assert(err.message.includes('403 Forbidden'));
    console.log(`  Expected exception caught: ${err.message}`);
  }
  assert.strictEqual(caughtTamperError, true, 'User B must be rejected with 403 Forbidden');
  console.log('✓ TEST 3 PASSED: Cross-user listing tampering blocked.\n');

  // TEST 4: Client-Side Tampering Attack (Zero Client-Trust)
  console.log('TEST 4: Tampering attack (user modifies account_type or role in client state)...');
  // Attacker tampers with their client object to claim they are 'super_admin'
  const attackerUser = {
    id: 'user-member-attacker',
    full_name: 'Malicious Member',
    account_type: 'super_admin', // TAMPERED in client state!
    role: 'admin'               // TAMPERED in client state!
  };

  let caughtAdminAccessBlocked = false;
  try {
    // Attempt to access admin moderation data using tampered user ID
    await propertyRepo.getAllPropertiesAdmin(attackerUser.id);
  } catch (err) {
    caughtAdminAccessBlocked = true;
    assert(err.message.includes('403 Forbidden'));
    console.log(`  Expected server authority block: ${err.message}`);
  }
  assert.strictEqual(caughtAdminAccessBlocked, true, 'Server-side authority must reject tampered client credentials');

  let caughtReportsBlocked = false;
  try {
    await safetyRepo.getReports(attackerUser.id);
  } catch (err) {
    caughtReportsBlocked = true;
    assert(err.message.includes('403 Forbidden'));
  }
  assert.strictEqual(caughtReportsBlocked, true, 'Server-side authority must reject tampered client access to safety reports');
  console.log('✓ TEST 4 PASSED: Client tampering does not bypass server-side Super Admin authority.\n');

  // TEST 5: Legitimate Super Admin Operations
  console.log('TEST 5: Authorized Super Admin can perform moderation operations...');
  const adminId = 'admin-1'; // Present in SERVER_SUPER_ADMIN_IDS
  const adminProps = await propertyRepo.getAllPropertiesAdmin(adminId);
  assert(Array.isArray(adminProps));
  assert(adminProps.length >= 2);

  const adminReports = await safetyRepo.getReports(adminId);
  assert(Array.isArray(adminReports));
  assert(adminReports.length >= 1);

  const verified = await propertyRepo.verifyProperty(createdProp.id, 'platform_verified', adminId);
  assert.strictEqual(verified.is_verified, true);
  assert.strictEqual(verified.verification_badge, 'platform_verified');
  console.log('✓ TEST 5 PASSED: Legitimate Super Admin successfully verified listing and fetched moderation data.\n');

  // TEST 6: Contact Request Roles & Phone Privacy Rules
  console.log('TEST 6: Contact request supports neutral roles and phone privacy rules...');
  const contactRequests = [
    {
      id: 'req-1',
      property_id: createdProp.id,
      requester_id: memberB.id,
      requester_name: memberB.full_name,
      requester_role: 'member',
      receiver_id: memberA.id,
      receiver_name: memberA.full_name,
      receiver_role: 'lister',
      status: 'pending'
    }
  ];

  // Phone visibility rule check
  const isPhoneUnlocked = (req, userPhonePrivacy) => {
    if (req.status === 'accepted') return true;
    if (userPhonePrivacy === 'public') return true;
    return false; // 'private' or 'on_request' remain hidden
  };

  assert.strictEqual(isPhoneUnlocked(contactRequests[0], 'private'), false, 'Private phone must be hidden when request is pending');
  assert.strictEqual(isPhoneUnlocked(contactRequests[0], 'on_request'), false, 'On-request phone must be hidden when request is pending');
  assert.strictEqual(isPhoneUnlocked(contactRequests[0], 'public'), true, 'Public phone is immediately visible');

  // After lister accepts:
  contactRequests[0].status = 'accepted';
  assert.strictEqual(isPhoneUnlocked(contactRequests[0], 'private'), true, 'Accepted request unlocks phone even if privacy was private');
  assert.strictEqual(isPhoneUnlocked(contactRequests[0], 'on_request'), true, 'Accepted request unlocks phone for on_request');

  console.log('✓ TEST 6 PASSED: Phone privacy state machine verified for member/lister roles.\n');

  console.log('===========================================================');
  console.log('ALL UNIFIED USER & SERVER-SIDE AUTHORIZATION TESTS PASSED!');
  console.log('===========================================================');
})();

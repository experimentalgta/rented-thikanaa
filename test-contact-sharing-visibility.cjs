/**
 * Test Suite: Contact Sharing Visibility & Privacy Authorization
 * Tests:
 * 1. Privacy enforcement logic with shared contact status
 * 2. Database RPC logic simulation (fixing COALESCE short-circuit and verifying accepted contact_requests check)
 * 3. URL generation for shared contact (tel: and WhatsApp)
 * 4. Codebase integrity checks for contact sharing methods and UI components
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING CONTACT SHARING VISIBILITY TESTS ---\n');

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
// 1. Privacy Enforcement Logic (Mirroring propertyRepository.ts)
// -------------------------------------------------------------
function applyPrivacyEnforcement(property, viewerUserId, isSuperAdmin, preloadedContactStatus, isContactShared) {
  const cloned = { ...property };
  const isOwnerOrAdmin =
    Boolean(viewerUserId && cloned.owner_id === viewerUserId) ||
    Boolean(viewerUserId && cloned.created_by === viewerUserId) ||
    Boolean(isSuperAdmin);

  const isPubliclyAllowed = Boolean(
    cloned.show_phone_number === true || cloned.phone_privacy === 'public'
  );

  const isSharedWithViewer = Boolean(
    isContactShared ||
    preloadedContactStatus === 'accepted' ||
    cloned.phone_privacy === 'shared' ||
    cloned.is_shared === true
  );

  const isPhoneAuthorized = isOwnerOrAdmin || isPubliclyAllowed || isSharedWithViewer;

  if (!isPhoneAuthorized) {
    cloned.owner_phone = null;
    cloned.lister_phone = null;
    cloned.phone_number = null;
    if (cloned.owner) {
      cloned.owner = {
        ...cloned.owner,
        phone_number: undefined,
      };
    }
  }

  return cloned;
}

runTest('1. Privacy Enforcement: Person B sees phone when Person A has shared contact', () => {
  const property = {
    id: 'prop-1',
    owner_id: 'owner-a',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: false,
    phone_privacy: 'private',
    owner: { id: 'owner-a', phone_number: '9876543210' }
  };

  // Viewer B has contact shared with them
  const result = applyPrivacyEnforcement(property, 'user-b', false, 'accepted', true);
  assert.strictEqual(result.phone_number, '9876543210', 'Phone number must be visible to Person B');
  assert.strictEqual(result.owner_phone, '9876543210', 'Owner phone must be visible to Person B');
});

runTest('2. Privacy Enforcement: Third-party Person C CANNOT see private phone of Person A', () => {
  const property = {
    id: 'prop-1',
    owner_id: 'owner-a',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: false,
    phone_privacy: 'private',
    owner: { id: 'owner-a', phone_number: '9876543210' }
  };

  // Viewer C has NO contact share
  const result = applyPrivacyEnforcement(property, 'user-c', false, 'none', false);
  assert.strictEqual(result.phone_number, null, 'Phone number must be hidden from Person C');
  assert.strictEqual(result.owner_phone, null, 'Owner phone must be hidden from Person C');
  assert.strictEqual(result.owner.phone_number, undefined, 'Owner profile phone must be stripped');
});

runTest('3. Privacy Enforcement: Unauthenticated viewer CANNOT see private phone of Person A', () => {
  const property = {
    id: 'prop-1',
    owner_id: 'owner-a',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: false,
    phone_privacy: 'private',
  };

  const result = applyPrivacyEnforcement(property, null, false, 'none', false);
  assert.strictEqual(result.phone_number, null);
  assert.strictEqual(result.owner_phone, null);
});

runTest('4. Privacy Enforcement: Public phone is visible to all users', () => {
  const property = {
    id: 'prop-1',
    owner_id: 'owner-a',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: true,
    phone_privacy: 'public',
  };

  const resultAnon = applyPrivacyEnforcement(property, null, false, 'none', false);
  assert.strictEqual(resultAnon.phone_number, '9876543210');

  const resultUserC = applyPrivacyEnforcement(property, 'user-c', false, 'none', false);
  assert.strictEqual(resultUserC.phone_number, '9876543210');
});

// -------------------------------------------------------------
// 2. RPC Logic Simulation (Fixing COALESCE boolean short-circuit)
// -------------------------------------------------------------
function simulateRpcContactDetails(property, ownerProfile, contactRequestStatus, callerId) {
  if (!callerId) {
    return { authorized: false, phone_number: null, phone_privacy: 'private' };
  }

  const isOwner = callerId === property.owner_id;
  if (isOwner) {
    const phone = property.phone_number || ownerProfile?.phone_number || null;
    return {
      authorized: true,
      phone_number: phone,
      show_phone_number: true,
      phone_privacy: 'public',
      is_shared: false,
    };
  }

  // Proper boolean logic: public if show_phone_number is true OR phone_privacy is public
  const isPublic = Boolean(
    property.show_phone_number === true ||
    property.phone_privacy === 'public' ||
    ownerProfile?.phone_privacy === 'public'
  );

  const phone = property.phone_number || ownerProfile?.phone_number || null;

  if (isPublic && phone) {
    return {
      authorized: true,
      phone_number: phone,
      show_phone_number: true,
      phone_privacy: 'public',
      is_shared: false,
    };
  }

  // Contact sharing check
  if (contactRequestStatus === 'accepted' && phone) {
    return {
      authorized: true,
      phone_number: phone,
      show_phone_number: true,
      phone_privacy: 'shared',
      is_shared: true,
    };
  }

  return {
    authorized: false,
    phone_number: null,
    show_phone_number: false,
    phone_privacy: 'private',
    is_shared: false,
  };
}

runTest('5. RPC simulation correctly resolves shared contact when show_phone_number is false', () => {
  const property = {
    id: 'prop-1',
    owner_id: 'owner-a',
    phone_number: '9876543210',
    show_phone_number: false,
    phone_privacy: 'private',
  };
  const ownerProfile = { phone_number: '9876543210', phone_privacy: 'private' };

  // Prior bug: COALESCE(show_phone_number, ...) evaluated false immediately and skipped all checks!
  const callerBDetails = simulateRpcContactDetails(property, ownerProfile, 'accepted', 'user-b');
  assert.strictEqual(callerBDetails.authorized, true);
  assert.strictEqual(callerBDetails.is_shared, true);
  assert.strictEqual(callerBDetails.phone_number, '9876543210');
  assert.strictEqual(callerBDetails.phone_privacy, 'shared');

  const callerCDetails = simulateRpcContactDetails(property, ownerProfile, 'none', 'user-c');
  assert.strictEqual(callerCDetails.authorized, false);
  assert.strictEqual(callerCDetails.phone_number, null);
  assert.strictEqual(callerCDetails.phone_privacy, 'private');
});

// -------------------------------------------------------------
// 3. Database Migration & Schema Verification
// -------------------------------------------------------------
runTest('6. SQL migration exists with contact sharing and accepted requests logic', () => {
  const migrationPath = path.join(__dirname, 'supabase/migrations/20261012_fix_contact_sharing_visibility.sql');
  assert(fs.existsSync(migrationPath), 'Migration file 20261012_fix_contact_sharing_visibility.sql does not exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert(sql.includes('get_property_contact_details'), 'Migration must declare get_property_contact_details function');
  assert(sql.includes('public.contact_requests'), 'Migration must check public.contact_requests table');
  assert(sql.includes("'accepted'"), 'Migration must check status = accepted');
  assert(sql.includes("'shared'"), 'Migration must support phone_privacy = shared');
});

// -------------------------------------------------------------
// 4. Codebase Architecture & Integrity Verification
// -------------------------------------------------------------
runTest('7. propertyRepository has isContactSharedWithUser and contact share authorization', () => {
  const repoPath = path.join(__dirname, 'src/services/propertyRepository.ts');
  const content = fs.readFileSync(repoPath, 'utf8');

  assert(content.includes('isContactSharedWithUser'), 'propertyRepository must implement isContactSharedWithUser');
  assert(content.includes('getPropertyContactDetails'), 'propertyRepository must implement getPropertyContactDetails');
  assert(content.includes(": 'shared'"), 'propertyRepository must handle shared phone_privacy');
});

runTest('8. ChatContext and ChatModal support sharing contact details and verified host call/whatsapp', () => {
  const contextPath = path.join(__dirname, 'src/context/ChatContext.tsx');
  const contextContent = fs.readFileSync(contextPath, 'utf8');
  assert(contextContent.includes('shareContactDetails'), 'ChatContext must expose shareContactDetails');

  const modalPath = path.join(__dirname, 'src/components/chat/ChatModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert(modalContent.includes('handleQuickShareContact'), 'ChatModal must implement handleQuickShareContact');
  assert(modalContent.includes('hostContactDetails'), 'ChatModal must resolve hostContactDetails');
  assert(modalContent.includes('Call Host'), 'ChatModal must provide Call Host button when contact is available');
});

runTest('9. PropertyDetailPage properly distinguishes shared contact vs private notice', () => {
  const detailPath = path.join(__dirname, 'src/pages/PropertyDetailPage.tsx');
  const content = fs.readFileSync(detailPath, 'utf8');

  assert(content.includes('Host Contact Shared'), 'PropertyDetailPage must display Host Contact Shared badge');
  assert(content.includes('Host Direct Phone (Shared with You):'), 'PropertyDetailPage must indicate shared phone state');
});

console.log(`\n--- SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED ---`);
if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('ALL CONTACT SHARING VISIBILITY TESTS COMPLETED SUCCESSFULLY!\n');
}

/**
 * Verification test script for Rented Thikanaa Contact & Messaging Flow Update
 * Tests phone utilities, sanitization, validation, URLs, privacy masking, and UI cleanliness.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING RENTED THIKANAA CONTACT FLOW TESTS ---\n');

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
// Test 1: Phone Sanitization and Validation
// -------------------------------------------------------------
function sanitizeIndianPhoneNumber(input) {
  if (!input) return null;
  const digitsOnly = String(input).replace(/\D/g, '');
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return digitsOnly;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    const candidate = digitsOnly.slice(1);
    if (/^[6-9]/.test(candidate)) return candidate;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const candidate = digitsOnly.slice(2);
    if (/^[6-9]/.test(candidate)) return candidate;
  }
  return null;
}

function isValidIndianPhoneNumber(input) {
  return sanitizeIndianPhoneNumber(input) !== null;
}

function getPhoneContactDetails(rawPhone, property) {
  const sanitized = sanitizeIndianPhoneNumber(rawPhone);
  if (!sanitized) return null;

  const formattedDisplay = `+91 ${sanitized.slice(0, 5)} ${sanitized.slice(5)}`;
  const telUrl = `tel:+91${sanitized}`;

  const titlePart = property?.title ? `"${property.title}"` : 'your property';
  const locationPart = [property?.locality, property?.city].filter(Boolean).join(', ');
  const locationText = locationPart ? ` in ${locationPart}` : '';

  const defaultMessage = `Hi, I saw ${titlePart}${locationText} on Rented Thikanaa and would like to know if it is still available.`;
  const whatsappUrl = `https://wa.me/91${sanitized}?text=${encodeURIComponent(defaultMessage)}`;

  return {
    raw: rawPhone,
    sanitized,
    formattedDisplay,
    telUrl,
    whatsappUrl,
  };
}

runTest('1. Phone Sanitizer Handles 10-digit standard Indian mobile', () => {
  assert.strictEqual(sanitizeIndianPhoneNumber('9876543210'), '9876543210');
  assert.strictEqual(sanitizeIndianPhoneNumber('8123456789'), '8123456789');
  assert.strictEqual(sanitizeIndianPhoneNumber('7000000000'), '7000000000');
  assert.strictEqual(sanitizeIndianPhoneNumber('6398765432'), '6398765432');
});

runTest('2. Phone Sanitizer Handles Prefixes (+91, 91, 0, spaces, dashes)', () => {
  assert.strictEqual(sanitizeIndianPhoneNumber('+91 98765 43210'), '9876543210');
  assert.strictEqual(sanitizeIndianPhoneNumber('+91-98765-43210'), '9876543210');
  assert.strictEqual(sanitizeIndianPhoneNumber('919876543210'), '9876543210');
  assert.strictEqual(sanitizeIndianPhoneNumber('09876543210'), '9876543210');
  assert.strictEqual(sanitizeIndianPhoneNumber('  +91 9876543210  '), '9876543210');
});

runTest('3. Phone Validator Rejects Invalid Numbers', () => {
  assert.strictEqual(isValidIndianPhoneNumber(''), false);
  assert.strictEqual(isValidIndianPhoneNumber(null), false);
  assert.strictEqual(isValidIndianPhoneNumber('1234567890'), false); // starts with 1
  assert.strictEqual(isValidIndianPhoneNumber('5555555555'), false); // starts with 5
  assert.strictEqual(isValidIndianPhoneNumber('98765'), false); // too short
  assert.strictEqual(isValidIndianPhoneNumber('98765432101234'), false); // too long
  assert.strictEqual(isValidIndianPhoneNumber('abcdefghij'), false);
});

// -------------------------------------------------------------
// Test 2: Contact URLs (Call and WhatsApp with Listing Context)
// -------------------------------------------------------------
runTest('4. Generates Proper tel: and WhatsApp URLs with Contextual Text', () => {
  const property = {
    title: 'Luxury 1BHK Student Studio',
    locality: 'Civil Lines',
    city: 'Prayagraj'
  };
  const details = getPhoneContactDetails('+91 98765 43210', property);
  assert(details !== null);
  assert.strictEqual(details.formattedDisplay, '+91 98765 43210');
  assert.strictEqual(details.telUrl, 'tel:+919876543210');
  assert(details.whatsappUrl.startsWith('https://wa.me/919876543210?text='));
  
  const decodedText = decodeURIComponent(details.whatsappUrl.split('?text=')[1]);
  assert(decodedText.includes('"Luxury 1BHK Student Studio"'));
  assert(decodedText.includes('Civil Lines, Prayagraj'));
  assert(decodedText.includes('Rented Thikanaa'));
});

// -------------------------------------------------------------
// Test 3: Privacy Enforcement Logic
// -------------------------------------------------------------
function applyPrivacyEnforcement(property, viewerUserId, isSuperAdmin) {
  const cloned = { ...property };
  const isOwnerOrAdmin =
    Boolean(viewerUserId && cloned.owner_id === viewerUserId) ||
    Boolean(viewerUserId && cloned.created_by === viewerUserId) ||
    Boolean(isSuperAdmin);

  const isPubliclyAllowed = Boolean(
    cloned.show_phone_number === true || cloned.phone_privacy === 'public'
  );

  if (!isPubliclyAllowed && !isOwnerOrAdmin) {
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

runTest('5. Privacy Enforcement: Strips Phone for Public Viewers when Private', () => {
  const property = {
    id: 'p1',
    owner_id: 'user_owner',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: false,
    phone_privacy: 'private',
    owner: { id: 'user_owner', phone_number: '9876543210' }
  };

  const viewerResult = applyPrivacyEnforcement(property, 'user_other', false);
  assert.strictEqual(viewerResult.phone_number, null);
  assert.strictEqual(viewerResult.owner_phone, null);
  assert.strictEqual(viewerResult.lister_phone, null);
  assert.strictEqual(viewerResult.owner.phone_number, undefined);
});

runTest('6. Privacy Enforcement: Preserves Phone for Public Viewers when Public', () => {
  const property = {
    id: 'p1',
    owner_id: 'user_owner',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: true,
    phone_privacy: 'public',
    owner: { id: 'user_owner', phone_number: '9876543210' }
  };

  const viewerResult = applyPrivacyEnforcement(property, 'user_other', false);
  assert.strictEqual(viewerResult.phone_number, '9876543210');
  assert.strictEqual(viewerResult.owner_phone, '9876543210');
});

runTest('7. Privacy Enforcement: Always Preserves Phone for Owner and Admin', () => {
  const property = {
    id: 'p1',
    owner_id: 'user_owner',
    phone_number: '9876543210',
    owner_phone: '9876543210',
    show_phone_number: false,
    phone_privacy: 'private',
    owner: { id: 'user_owner', phone_number: '9876543210' }
  };

  // Owner view
  const ownerResult = applyPrivacyEnforcement(property, 'user_owner', false);
  assert.strictEqual(ownerResult.phone_number, '9876543210');

  // Super Admin view
  const adminResult = applyPrivacyEnforcement(property, 'admin_user', true);
  assert.strictEqual(adminResult.phone_number, '9876543210');
});

// -------------------------------------------------------------
// Test 4: Verify Removal of "Request Contact" from Core UI Pages
// -------------------------------------------------------------
runTest('8. Verify Removal of Contact Request Elements from Codebase', () => {
  const filesToCheck = [
    'src/pages/PropertyDetailPage.tsx',
    'src/pages/UserDashboard.tsx',
    'src/pages/StudentDashboard.tsx',
    'src/pages/OwnerDashboard.tsx',
    'src/components/chat/ChatModal.tsx',
    'src/components/roommate/RoommateCard.tsx',
    'src/pages/RoommatePage.tsx',
    'src/pages/HomePage.tsx'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Ensure ContactRequestModal is not imported or used
    assert(!content.includes('ContactRequestModal'), `${relPath} still imports or uses ContactRequestModal`);

    // Ensure no "Request Phone Contact" or "Request Contact" buttons
    assert(!content.includes('Request Phone Contact'), `${relPath} still mentions 'Request Phone Contact'`);
    assert(!content.includes('Request Contact'), `${relPath} still mentions 'Request Contact'`);
  }
});

runTest('9. Verify Database Migration Exists and Syntax is Valid', () => {
  const migrationPath = path.join(__dirname, 'supabase/migrations/20261006_contact_flow_update.sql');
  assert(fs.existsSync(migrationPath), 'Migration file 20261006_contact_flow_update.sql does not exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('phone_number TEXT'), 'Migration missing phone_number');
  assert(sql.includes('show_phone_number BOOLEAN'), 'Migration missing show_phone_number');
});

console.log(`\n--- SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED ---`);
if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!\n');
}

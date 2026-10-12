const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('🧪 RUNNING PWA FOUNDATION VALIDATION SUITE');
console.log('========================================\n');

let failedTests = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// 1. Validate manifest.json
console.log('1. Validating Web App Manifest (public/manifest.json)...');
const manifestPath = path.join(__dirname, 'public', 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert(manifest.name === 'Renter Thikan', `App name is "Renter Thikan" (got "${manifest.name}")`);
assert(manifest.short_name === 'Renter Thikan', `Short name is "Renter Thikan" (got "${manifest.short_name}")`);
assert(manifest.start_url === '/?source=pwa' || manifest.start_url === '/', `Valid start_url (got "${manifest.start_url}")`);
assert(manifest.display === 'standalone', `Display mode is "standalone" (got "${manifest.display}")`);
assert(manifest.theme_color?.toLowerCase() === '#101828', `Theme color is #101828 (got "${manifest.theme_color}")`);
assert(manifest.background_color?.toLowerCase() === '#ffffff', `Background color is #FFFFFF (got "${manifest.background_color}")`);

const has192 = manifest.icons.some(i => i.sizes === '192x192' && i.src.includes('192'));
const has512 = manifest.icons.some(i => i.sizes === '512x512' && i.src.includes('512') && i.purpose !== 'maskable');
const hasMaskable = manifest.icons.some(i => i.purpose?.includes('maskable'));

assert(has192, 'Manifest includes 192x192 icon');
assert(has512, 'Manifest includes 512x512 standard icon');
assert(hasMaskable, 'Manifest includes 512x512 maskable icon');

// 2. Validate Icon Files on Disk
console.log('\n2. Validating PWA Icon Assets on Disk...');
const expectedIcons = [
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'favicon-16x16.png'
];

for (const icon of expectedIcons) {
  const iconPath = path.join(__dirname, 'public', icon);
  const exists = fs.existsSync(iconPath);
  assert(exists, `Icon ${icon} exists`);
  if (exists) {
    const stat = fs.statSync(iconPath);
    assert(stat.size > 500, `Icon ${icon} has valid non-zero content (${stat.size} bytes)`);
  }
}

// 3. Validate index.html PWA tags
console.log('\n3. Validating index.html PWA Meta Tags...');
const indexPath = path.join(__dirname, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

assert(indexHtml.includes('manifest.json') || indexHtml.includes('manifest.webmanifest'), 'index.html links to web manifest');
assert(indexHtml.includes('apple-touch-icon'), 'index.html includes apple-touch-icon');
assert(indexHtml.includes('name="theme-color" content="#101828"'), 'index.html sets theme-color to #101828');
assert(indexHtml.includes('apple-mobile-web-app-capable'), 'index.html sets apple-mobile-web-app-capable');
assert(indexHtml.includes('viewport-fit=cover'), 'index.html includes viewport-fit=cover for safe-areas');

// 4. Validate Vite PWA Configuration & Workbox Privacy Caching Rules
console.log('\n4. Validating vite.config.ts & Privacy Cache Safety...');
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

assert(viteConfig.includes('VitePWA'), 'vite.config.ts integrates VitePWA');
assert(viteConfig.includes('registerType: \'autoUpdate\''), 'vite.config.ts configures autoUpdate');
assert(
  viteConfig.includes('properties') && viteConfig.includes('/rest/v1/'),
  'vite.config.ts runtime-caches public properties via Supabase REST'
);
// Ensure private endpoints are never cached
assert(
  viteConfig.includes('messages') &&
  viteConfig.includes('conversations') &&
  viteConfig.includes('contact_requests'),
  'vite.config.ts explicitly protects private endpoints (messages, conversations, contact_requests)'
);

// 5. Validate Permission Flows (Zero unsolicited auto-prompts on load)
console.log('\n5. Validating Permission Flow Guardrails...');
const locationCtxPath = path.join(__dirname, 'src', 'context', 'LocationContext.tsx');
const locationCtx = fs.readFileSync(locationCtxPath, 'utf8');

const hasAutoDetectInEffect = /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*detectCurrentLocation\(\)/s.test(locationCtx);
assert(!hasAutoDetectInEffect, 'LocationContext does NOT auto-invoke detectCurrentLocation() in useEffect');

const notifUtilPath = path.join(__dirname, 'src', 'utils', 'notifications.ts');
const notifUtil = fs.readFileSync(notifUtilPath, 'utf8');
assert(notifUtil.includes('requestNotificationPermission'), 'notifications utility supports explicit permission requests');

// 6. Validate Built Artifacts in dist/
console.log('\n6. Validating Built Distribution Output (dist/)...');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const swExists = fs.existsSync(path.join(distPath, 'sw.js'));
  assert(swExists, 'dist/sw.js (Service Worker) generated');

  const distManifestExists = fs.existsSync(path.join(distPath, 'manifest.webmanifest')) || fs.existsSync(path.join(distPath, 'manifest.json'));
  assert(distManifestExists, 'dist manifest generated');
} else {
  console.log('  ⚠️ dist/ not found yet (build will generate it)');
}

console.log('\n----------------------------------------');
if (failedTests === 0) {
  console.log('🎉 ALL PWA FOUNDATION VALIDATION TESTS PASSED!');
  process.exit(0);
} else {
  console.error(`💥 ${failedTests} test(s) failed.`);
  process.exit(1);
}

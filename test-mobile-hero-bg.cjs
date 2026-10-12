const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 RUNNING MOBILE HERO BACKGROUND IMAGE VALIDATION');
console.log('====================================================\n');

let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

// 1. Asset check in public/assets/
console.log('1. Checking public/assets/room-bg.jpg asset...');
const assetPath = path.join(__dirname, 'public', 'assets', 'room-bg.jpg');
assert(fs.existsSync(assetPath), 'public/assets/room-bg.jpg exists on disk');
if (fs.existsSync(assetPath)) {
  const stat = fs.statSync(assetPath);
  assert(stat.size > 50000, `room-bg.jpg has valid non-zero content (${stat.size} bytes)`);
}

// 2. Check HomePage.tsx implementation
console.log('\n2. Checking HomePage.tsx background & overlay styles...');
const homePagePath = path.join(__dirname, 'src', 'pages', 'HomePage.tsx');
const homeContent = fs.readFileSync(homePagePath, 'utf8');

assert(
  homeContent.includes("url('/assets/room-bg.jpg')") || homeContent.includes('url("/assets/room-bg.jpg")'),
  'HomePage.tsx applies background-image url(/assets/room-bg.jpg)'
);
assert(homeContent.includes("backgroundSize: 'cover'"), 'backgroundSize is cover');
assert(homeContent.includes("backgroundPosition: 'center 38%'") || homeContent.includes("backgroundPosition: 'center top'"), 'backgroundPosition is configured correctly');
assert(homeContent.includes("backgroundRepeat: 'no-repeat'"), 'backgroundRepeat is no-repeat');
assert(homeContent.includes('rgba(10, 25, 47,') && homeContent.includes('linear-gradient(180deg,'), 'Dark navy overlay gradient applied');
assert(homeContent.includes('md:hidden') && homeContent.includes('pointer-events-none'), 'Mobile background layer is md:hidden and pointer-events-none');
assert(homeContent.includes('md:bg-gradient-to-b') && homeContent.includes('md:from-[#101828]'), 'Desktop background gradient is preserved with md: responsive prefix');
assert(homeContent.includes('block md:hidden relative z-10'), 'Mobile search controls have relative z-10 stacking above overlay');

// 3. Distribution build asset check
console.log('\n3. Checking distribution output (dist/)...');
const distAssetPath = path.join(__dirname, 'dist', 'assets', 'room-bg.jpg');
assert(fs.existsSync(distAssetPath), 'dist/assets/room-bg.jpg exists in build output');

console.log('\n----------------------------------------------------');
if (failed === 0) {
  console.log('🎉 ALL MOBILE HERO BACKGROUND TESTS PASSED!');
  process.exit(0);
} else {
  console.error(`💥 ${failed} test(s) failed.`);
  process.exit(1);
}

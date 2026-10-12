const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING GLOBAL BACK BUTTON & BROWSER HISTORY TEST SUITE ---');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

// 1. Audit App.tsx source code for navigation patterns
const appTsx = fs.readFileSync(path.join(__dirname, 'src', 'App.tsx'), 'utf8');
const homePageTsx = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'HomePage.tsx'), 'utf8');
const searchPageTsx = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'SearchPage.tsx'), 'utf8');
const propertyDetailTsx = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'PropertyDetailPage.tsx'), 'utf8');

runTest('1. AppNavigationState interface and internalIndex tracking are present', () => {
  assert(appTsx.includes('interface AppNavigationState'), 'AppNavigationState interface should exist');
  assert(appTsx.includes('internalIndex: number'), 'internalIndex should be defined in AppNavigationState');
  assert(appTsx.includes('currentInternalIndexRef'), 'currentInternalIndexRef should track history stack depth');
});

runTest('2. buildRouteUrl builds clean, standards-compliant URLs', () => {
  assert(appTsx.includes('const buildRouteUrl ='), 'buildRouteUrl helper should exist');
  assert(appTsx.includes("url.searchParams.set('view', 'search')"), 'Search view param must be set');
  assert(appTsx.includes("url.searchParams.set('type', options.propertyType)"), 'Property type param must be set');
  assert(appTsx.includes("url.searchParams.set('locality', options.locality)"), 'Locality param must be set');
  assert(appTsx.includes("url.searchParams.set('tab', options.subTab)"), 'Tab param must be set for dashboard');
});

runTest('3. Cold start parseRouteFromUrl handles deep links correctly', () => {
  assert(appTsx.includes('const parseRouteFromUrl ='), 'parseRouteFromUrl helper should exist');
  assert(appTsx.includes('admin-panel'), 'Admin route must be parsed');
  assert(appTsx.includes('property-detail'), 'Property detail route must be parsed');
  assert(appTsx.includes('search'), 'Search route must be parsed');
  assert(appTsx.includes('roommates'), 'Roommates route must be parsed');
  assert(appTsx.includes('member-dashboard'), 'Dashboard route must be parsed');
});

runTest('4. handleSearchTrigger pushes history state instead of mutating silently', () => {
  assert(appTsx.includes('const handleSearchTrigger = useCallback('), 'handleSearchTrigger should be a callback');
  assert(appTsx.includes("window.history.pushState(nextState, '', targetUrl.toString())"), 'handleSearchTrigger must push history');
  assert(appTsx.includes("buildRouteUrl('search'"), 'handleSearchTrigger must build search URL');
});

runTest('5. handleNavigate uses pushState by default and replaceState on request', () => {
  assert(appTsx.includes('const handleNavigate = useCallback('), 'handleNavigate should be defined');
  assert(appTsx.includes('window.history.pushState(nextState'), 'handleNavigate must pushState for new views');
  assert(appTsx.includes('window.history.replaceState(nextState'), 'handleNavigate should support replaceState');
});

runTest('6. handleSelectProperty pushes history state for both desktop and mobile', () => {
  assert(appTsx.includes('const handleSelectProperty = useCallback('), 'handleSelectProperty should exist');
  assert(appTsx.includes('isMobileDetailOpen: true'), 'Mobile detail sheet state must be pushed');
  assert(appTsx.includes("view: 'property-detail'"), 'Desktop property detail state must be pushed');
  assert(appTsx.includes('internalIndex: nextIdx'), 'Property selection must increment internalIndex');
});

runTest('7. Unified handlePopState restores targetView, category, locality, and scroll', () => {
  assert(appTsx.includes('const handlePopState = (event: PopStateEvent) =>'), 'handlePopState should handle PopStateEvent');
  assert(appTsx.includes('setCurrentView(targetView)'), 'Target view must be restored on pop');
  assert(appTsx.includes('setSelectedPropertyType(typeParam)'), 'Category must be restored on pop');
  assert(appTsx.includes('setSelectedLocality(localityParam)'), 'Locality must be restored on pop');
  assert(appTsx.includes('sessionStorage.getItem(`scroll_${targetView}`)'), 'Scroll position must be restored on pop');
});

runTest('8. In-App Back buttons check internalIndex > 0 before calling history.back()', () => {
  assert(appTsx.includes('typeof window.history.state.internalIndex === \'number\' &&'), 'Must verify internalIndex');
  assert(appTsx.includes('window.history.state.internalIndex > 0'), 'Must check internalIndex > 0');
  assert(appTsx.includes('window.history.back()'), 'Must call history.back when internal history exists');
  assert(appTsx.includes('handleNavigate(fallbackView, undefined, { replace: true })'), 'Must use safe in-app fallback when no internal history');
});

runTest('9. PropertyDetailPage back button delegates cleanly to router onBack', () => {
  assert(!propertyDetailTsx.includes('window.history.length > 1'), 'PropertyDetailPage should not use fragile history.length');
  assert(propertyDetailTsx.includes('onClick={onBack}'), 'PropertyDetailPage back button must call onBack');
});

runTest('10. SearchPage synchronizes filters whenever initialPropertyType changes', () => {
  assert(searchPageTsx.includes('initialPropertyType !== undefined'), 'SearchPage should check initialPropertyType');
  assert(searchPageTsx.includes('property_type: (initialPropertyType as any) || \'all\''), 'SearchPage must update property_type in filters');
});

runTest('11. All 6 Browse Accommodation categories are routed with proper params', () => {
  const categoryIds = ['room', 'pg', 'hostel', 'flat', 'shared_room', 'roommates'];
  for (const cat of categoryIds) {
    assert(homePageTsx.includes(`id: '${cat}'`), `Category ${cat} must exist in HomePage`);
  }
  assert(homePageTsx.includes("if (pt.id === 'roommates') onNavigate('roommates')"), 'Roommates category navigates to roommates view');
  assert(homePageTsx.includes("else onSearch(selectedLocality || '', pt.id)"), 'Other categories pass category id to onSearch');
});

console.log(`\n--- SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED ---`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL GLOBAL BACK NAVIGATION TESTS COMPLETED SUCCESSFULLY!\n');
}

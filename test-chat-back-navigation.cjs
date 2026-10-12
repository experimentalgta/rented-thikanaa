const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING CHAT BACK NAVIGATION & CHAT RESET TEST SUITE ---\n');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failedCount++;
  }
}

const chatContextCode = fs.readFileSync(path.join(__dirname, 'src', 'context', 'ChatContext.tsx'), 'utf-8');
const chatModalCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'chat', 'ChatModal.tsx'), 'utf-8');
const appCode = fs.readFileSync(path.join(__dirname, 'src', 'App.tsx'), 'utf-8');
const headerCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'layout', 'Header.tsx'), 'utf-8');
const mobileNavCode = fs.readFileSync(path.join(__dirname, 'src', 'components', 'layout', 'MobileNav.tsx'), 'utf-8');
const userDashboardCode = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'UserDashboard.tsx'), 'utf-8');
const studentDashboardCode = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'StudentDashboard.tsx'), 'utf-8');
const ownerDashboardCode = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'OwnerDashboard.tsx'), 'utf-8');

test('1. ChatContext defines and exports openMessagesList and clearActiveConversation', () => {
  assert(chatContextCode.includes('openMessagesList: () => void'), 'ChatContextType must include openMessagesList');
  assert(chatContextCode.includes('clearActiveConversation: () => void'), 'ChatContextType must include clearActiveConversation');
  assert(chatContextCode.includes('const clearActiveConversation = useCallback('), 'clearActiveConversation implementation exists');
  assert(chatContextCode.includes('const openMessagesList = useCallback('), 'openMessagesList implementation exists');
  assert(chatContextCode.includes('openMessagesList,'), 'ChatProvider must provide openMessagesList in value');
  assert(chatContextCode.includes('clearActiveConversation,'), 'ChatProvider must provide clearActiveConversation in value');
});

test('2. ChatContext clears active conversation whenever modal is closed or conversation is deselected', () => {
  assert(chatContextCode.includes('if (!open) {\n      clearActiveConversation();\n    }'), 'setIsChatModalOpen(false) must clear active conversation');
  assert(chatContextCode.includes('if (!conv) {\n        clearActiveConversation();\n        return;\n      }'), 'selectConversation(null) must clear active conversation');
});

test('3. ChatModal initializes mobileView to threads (not chat)', () => {
  assert(chatModalCode.includes("const [mobileView, setMobileView] = useState<'threads' | 'chat'>('threads');"),
    "ChatModal must initialize mobileView to 'threads'");
});

test('4. ChatModal does NOT auto-select conversations[0] on desktop', () => {
  assert(!chatModalCode.includes('selectConversation(conversations[0])'),
    'ChatModal must NOT automatically select conversations[0] on mount or conversation change');
});

test('5. ChatModal displays clean placeholder state on desktop when activeConversation is null', () => {
  assert(chatModalCode.includes('Select a Conversation'), 'ChatModal desktop right column must show "Select a Conversation" placeholder');
  assert(chatModalCode.includes('Choose an inquiry from the list on the left'), 'Placeholder must instruct user to select an inquiry');
  assert(chatModalCode.includes('activeConversation ? ('), 'Desktop right column must conditionally render message thread or placeholder');
});

test('6. ChatModal synchronizes Level 1 (list) and Level 2 (individual chat) browser history states', () => {
  assert(chatModalCode.includes('chatLevel: 1'), 'ChatModal pushes chatLevel: 1 for message list');
  assert(chatModalCode.includes('chatLevel: 2'), 'ChatModal pushes chatLevel: 2 for individual chat');
  assert(chatModalCode.includes('hadListStep: true'), 'ChatModal marks hadListStep when selecting conversation from list');
  assert(chatModalCode.includes('isStateInSync'), 'ChatModal avoids duplicate pushState on popstate sync');
});

test('7. ChatModal mobile header buttons route to handleBackFromChat and handleCloseMessagesModal', () => {
  assert(chatModalCode.includes("mobileView === 'chat' ? ("), 'Mobile header checks mobileView === chat');
  assert(chatModalCode.includes('onClick={handleBackFromChat}'), 'Back button in chat view must call handleBackFromChat');
  assert(chatModalCode.includes('onClick={handleCloseMessagesModal}'), 'Back/Close button in threads view must call handleCloseMessagesModal');
});

test('8. ChatModal handleBackFromChat steps back to conversation list without leaving modal', () => {
  assert(chatModalCode.includes('const handleBackFromChat = () => {'), 'handleBackFromChat function must exist');
  assert(chatModalCode.includes('window.history.back()'), 'handleBackFromChat must use history.back() when hadListStep');
  assert(chatModalCode.includes('clearActiveConversation()'), 'handleBackFromChat must clear active conversation on direct fallback');
  assert(chatModalCode.includes("setMobileView('threads')"), 'handleBackFromChat must switch mobileView to threads');
});

test('9. App.tsx handlePopState intercepts active chat and returns to Messages list without closing modal or navigating Home', () => {
  assert(appCode.includes('isPoppingToMessageList'), 'App.tsx handlePopState must detect isPoppingToMessageList');
  assert(appCode.includes('clearActiveConversation();\n          return;'),
    'App.tsx handlePopState must call clearActiveConversation() and return immediately without closing modal');
  assert(appCode.includes('activeConversationRef.current = activeConversation;'),
    'App.tsx must maintain activeConversationRef for synchronous popstate inspection');
});

test('10. App.tsx handleNavigate cleanly clears active conversation and closes modal', () => {
  assert(appCode.includes('setIsChatModalOpen(false);\n    clearActiveConversation();'),
    'handleNavigate must call both setIsChatModalOpen(false) and clearActiveConversation()');
});

test('11. Navigation entry points (Header, MobileNav, Dashboards) use openMessagesList()', () => {
  assert(headerCode.includes('openMessagesList();'), 'Header must call openMessagesList()');
  assert(mobileNavCode.includes('openMessagesList();'), 'MobileNav must call openMessagesList()');
  assert(userDashboardCode.includes('openMessagesList()'), 'UserDashboard must call openMessagesList()');
  assert(studentDashboardCode.includes('openMessagesList()'), 'StudentDashboard must call openMessagesList()');
  assert(ownerDashboardCode.includes('openMessagesList()'), 'OwnerDashboard must call openMessagesList()');
});

console.log(`\n--- SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ---`);
if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL CHAT BACK NAVIGATION & CHAT RESET TESTS COMPLETED SUCCESSFULLY!\n');
}

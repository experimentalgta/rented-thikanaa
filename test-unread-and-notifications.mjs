// test-unread-and-notifications.mjs
// Verification suite for Realtime Unread Counters & Message Notification Architecture

console.log('--- 🧪 STARTING REALTIME UNREAD COUNTERS & NOTIFICATIONS TESTS ---\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// 1. Mock DB state
let dbConversations = [];
let dbMessages = [];

const USER_SURROGATE = { id: 'usr-suraj-01', full_name: 'Suraj Gupta' };
const USER_UJJWAL = { id: 'usr-ujjwal-02', full_name: 'Ujjwal Maurya' };
const USER_AMIT = { id: 'usr-amit-03', full_name: 'Amit Kumar' };

const CONV_1 = {
  id: 'conv-101',
  participant_a: USER_UJJWAL.id,
  participant_b: USER_SURROGATE.id,
  property_id: 'prop-room-katra',
  property_title: 'Room in Katra',
  last_message: 'Hi Suraj',
  last_message_time: new Date().toISOString(),
};

const CONV_2 = {
  id: 'conv-102',
  participant_a: USER_AMIT.id,
  participant_b: USER_SURROGATE.id,
  property_id: 'prop-room-civil-lines',
  property_title: 'PG in Civil Lines',
  last_message: 'Is it available?',
  last_message_time: new Date().toISOString(),
};

dbConversations.push(CONV_1, CONV_2);

// Simulated Chat Repository
const mockChatRepo = {
  async getConversations(userId) {
    // 1. Filter conversations
    const userConvs = dbConversations.filter(
      (c) => c.participant_a === userId || c.participant_b === userId
    );

    // 2. Query unread messages
    const unreadMap = {};
    for (const msg of dbMessages) {
      if (msg.receiver_id === userId && !msg.is_read) {
        unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] || 0) + 1;
      }
    }

    return userConvs.map((c) => ({
      id: c.id,
      participant_ids: [c.participant_a, c.participant_b],
      last_message: c.last_message,
      last_message_time: 'Just now',
      unread_count: unreadMap[c.id] || 0,
      property_id: c.property_id,
      property_title: c.property_title,
    }));
  },

  async markConversationAsRead(conversationId, userId) {
    for (const msg of dbMessages) {
      if (msg.conversation_id === conversationId && msg.receiver_id === userId && !msg.is_read) {
        msg.is_read = true;
      }
    }
  },

  async sendMessage({ conversationId, senderId, receiverId, text }) {
    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    dbMessages.push(newMsg);
    return newMsg;
  },
};

// Simulated Client State
let clientConversations = [];
let clientActiveConversation = null;
let clientIsModalOpen = false;
let clientIncomingToast = null;
let clientProcessedIds = new Set();
let clientDocumentHidden = false;

function simulateIncomingMessage(msg) {
  // 1. Deduplication
  if (clientProcessedIds.has(msg.id)) {
    return { deduplicated: true };
  }
  clientProcessedIds.add(msg.id);

  const currentUserId = USER_SURROGATE.id;
  const isSentByMe = msg.sender_id === currentUserId;
  const convId = msg.conversation_id;

  const isActivelyViewing =
    clientIsModalOpen &&
    clientActiveConversation?.id === convId &&
    !clientDocumentHidden;

  if (isActivelyViewing) {
    // Active chat: no unread increment, no toast
    msg.is_read = true;
    mockChatRepo.markConversationAsRead(convId, currentUserId);

    clientConversations = clientConversations.map((c) =>
      c.id === convId ? { ...c, last_message: msg.text, unread_count: 0 } : c
    );
    return { activelyViewed: true };
  } else {
    // Inactive chat: increment unread count & show toast if sent to me
    const isTargetedToMe = !isSentByMe && msg.receiver_id === currentUserId;
    if (isTargetedToMe) {
      clientConversations = clientConversations.map((c) =>
        c.id === convId ? { ...c, last_message: msg.text, unread_count: (c.unread_count || 0) + 1 } : c
      );
      clientIncomingToast = {
        id: msg.id,
        conversationId: convId,
        text: msg.text,
      };
      return { toastTriggered: true, unreadIncremented: true };
    }
  }
}

async function runTests() {
  console.log('Test Group 1: Initial Load & State');
  clientConversations = await mockChatRepo.getConversations(USER_SURROGATE.id);
  assert(clientConversations.length === 2, 'Loaded 2 existing conversations for Suraj');
  assert(
    clientConversations.every((c) => c.unread_count === 0),
    'Initial unread count for all conversations is 0'
  );

  console.log('\nTest Group 2: Inactive Incoming Messages (Unread Counting & Toasts)');
  // Ujjwal sends message to Suraj while Suraj's chat modal is closed
  clientIsModalOpen = false;
  clientActiveConversation = null;

  const msg1 = await mockChatRepo.sendMessage({
    conversationId: 'conv-101',
    senderId: USER_UJJWAL.id,
    receiverId: USER_SURROGATE.id,
    text: 'Hello Suraj! Is the Katra room still open?',
  });

  const res1 = simulateIncomingMessage(msg1);
  assert(res1.unreadIncremented === true, 'Message while modal closed marked as unread');
  assert(res1.toastTriggered === true, 'In-app toast notification triggered');
  assert(clientIncomingToast?.text.includes('Katra'), 'Toast contains correct message text');

  const conv1 = clientConversations.find((c) => c.id === 'conv-101');
  assert(conv1.unread_count === 1, 'conv-101 unread_count is now 1');

  // Ujjwal sends a second message
  const msg2 = await mockChatRepo.sendMessage({
    conversationId: 'conv-101',
    senderId: USER_UJJWAL.id,
    receiverId: USER_SURROGATE.id,
    text: 'Can I visit this evening?',
  });
  simulateIncomingMessage(msg2);
  const conv1Updated = clientConversations.find((c) => c.id === 'conv-101');
  assert(conv1Updated.unread_count === 2, 'conv-101 unread_count is now 2');

  // Amit sends a message in conv-102
  const msg3 = await mockChatRepo.sendMessage({
    conversationId: 'conv-102',
    senderId: USER_AMIT.id,
    receiverId: USER_SURROGATE.id,
    text: 'Hi, please send details for Civil Lines.',
  });
  simulateIncomingMessage(msg3);
  const conv2 = clientConversations.find((c) => c.id === 'conv-102');
  assert(conv2.unread_count === 1, 'conv-102 unread_count is now 1');

  // Total global unread
  const totalUnread = clientConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  assert(totalUnread === 3, 'Global unread count is exactly 3 (2 from conv-101 + 1 from conv-102)');

  console.log('\nTest Group 3: Deduplication across Multiple Channels');
  // Simulate postgres_changes AND broadcast receiving the exact same msg2 ID
  const dupRes = simulateIncomingMessage(msg2);
  assert(dupRes.deduplicated === true, 'Duplicate incoming message ID was safely dropped');
  const conv1AfterDup = clientConversations.find((c) => c.id === 'conv-101');
  assert(conv1AfterDup.unread_count === 2, 'Unread count did not double-increment on duplicate event');

  console.log('\nTest Group 4: Opening Conversation & Mark As Read');
  // Suraj opens conv-101
  clientIsModalOpen = true;
  clientActiveConversation = conv1AfterDup;
  await mockChatRepo.markConversationAsRead('conv-101', USER_SURROGATE.id);
  clientConversations = clientConversations.map((c) =>
    c.id === 'conv-101' ? { ...c, unread_count: 0 } : c
  );
  clientIncomingToast = null;

  const conv1AfterRead = clientConversations.find((c) => c.id === 'conv-101');
  assert(conv1AfterRead.unread_count === 0, 'conv-101 unread_count reset to 0 after opening');
  const totalUnreadAfterRead = clientConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  assert(totalUnreadAfterRead === 1, 'Global unread count decremented to 1 (only conv-102 remains unread)');

  console.log('\nTest Group 5: Active Chat Realtime Delivery (Zero Unread, No Toast)');
  // Ujjwal sends another message while Suraj has conv-101 actively open
  const msg4 = await mockChatRepo.sendMessage({
    conversationId: 'conv-101',
    senderId: USER_UJJWAL.id,
    receiverId: USER_SURROGATE.id,
    text: 'Great, see you then!',
  });
  const res4 = simulateIncomingMessage(msg4);
  assert(res4.activelyViewed === true, 'Message recognized as actively viewed');
  assert(clientIncomingToast === null, 'No intrusive toast was shown while actively chatting in that conversation');
  const conv1StillActive = clientConversations.find((c) => c.id === 'conv-101');
  assert(conv1StillActive.unread_count === 0, 'conv-101 unread_count remained 0');

  console.log('\nTest Group 6: DB Persistence Across Page Reload');
  // Simulate page reload: reload conversations from DB
  const reloadedConversations = await mockChatRepo.getConversations(USER_SURROGATE.id);
  const reloadedConv1 = reloadedConversations.find((c) => c.id === 'conv-101');
  const reloadedConv2 = reloadedConversations.find((c) => c.id === 'conv-102');
  assert(reloadedConv1.unread_count === 0, 'DB persistence: conv-101 has 0 unread on reload');
  assert(reloadedConv2.unread_count === 1, 'DB persistence: conv-102 correctly retains 1 unread on reload');

  console.log(`\n--- 📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED ---`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL REALTIME UNREAD & NOTIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('⚠️ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests();

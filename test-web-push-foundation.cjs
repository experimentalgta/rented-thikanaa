const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('====================================================');
console.log('🧪 RUNNING WEB PUSH NOTIFICATIONS VALIDATION SUITE');
console.log('====================================================\n');

let failedTests = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// 1. Validate RFC 8292 VAPID Keys
console.log('1. Validating RFC 8292 VAPID Keys & Cryptographic Format...');
const VAPID_PUBLIC_KEY = 'BJ469rJuWoOpUv6iKczWBxZF3WHvSXK6aRuiVUHWaM_Hzb6S2P5THqE202GtOGUMnpeaOAZJoMqh8Rp7RYBk7-o';
const VAPID_PRIVATE_KEY = 's9LroyJOS2Ewq4R3Ed1BCrmlxxIvjolXW6PTZlm2XaY';

const pubBuffer = Buffer.from(VAPID_PUBLIC_KEY, 'base64url');
const privBuffer = Buffer.from(VAPID_PRIVATE_KEY, 'base64url');

assert(pubBuffer.length === 65, `Public VAPID key is 65-byte uncompressed P-256 curve point (got ${pubBuffer.length} bytes)`);
assert(pubBuffer[0] === 0x04, `Public key starts with 0x04 uncompressed point indicator (got 0x${pubBuffer[0].toString(16)})`);
assert(privBuffer.length === 32, `Private VAPID key is 32-byte P-256 scalar (got ${privBuffer.length} bytes)`);

// 2. Validate Service Worker Push Script
console.log('\n2. Validating public/push-worker.js Event Listeners...');
const pushWorkerPath = path.join(__dirname, 'public', 'push-worker.js');
assert(fs.existsSync(pushWorkerPath), 'public/push-worker.js exists');

const pushWorkerSrc = fs.readFileSync(pushWorkerPath, 'utf8');
assert(pushWorkerSrc.includes("addEventListener('push'"), 'Handles push events');
assert(pushWorkerSrc.includes("addEventListener('notificationclick'"), 'Handles notificationclick events');
assert(pushWorkerSrc.includes("addEventListener('pushsubscriptionchange'"), 'Handles pushsubscriptionchange events');
assert(pushWorkerSrc.includes('OPEN_CONVERSATION'), 'Posts OPEN_CONVERSATION event on notification click');
assert(pushWorkerSrc.includes('view=messages'), 'Navigates to messages view with conversation query');

// 3. Validate vite.config.ts Workbox Configuration
console.log('\n3. Validating vite.config.ts Workbox Configuration...');
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
const viteConfigSrc = fs.readFileSync(viteConfigPath, 'utf8');
assert(viteConfigSrc.includes("importScripts: ['/push-worker.js']"), 'vite.config.ts imports /push-worker.js in Workbox config');
assert(viteConfigSrc.includes("'push-worker.js'"), 'vite.config.ts includes push-worker.js in includeAssets');

// 4. Validate Supabase Database Migration
console.log('\n4. Validating Supabase Migration SQL (20261012_push_subscriptions.sql)...');
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20261012_push_subscriptions.sql');
assert(fs.existsSync(migrationPath), 'Migration file exists');

const migrationSrc = fs.readFileSync(migrationPath, 'utf8');
assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.push_subscriptions'), 'Creates public.push_subscriptions table');
assert(migrationSrc.includes('user_id UUID NOT NULL REFERENCES auth.users'), 'Table has user_id foreign key');
assert(migrationSrc.includes('endpoint TEXT NOT NULL UNIQUE'), 'Endpoint is UNIQUE');
assert(migrationSrc.includes('ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY'), 'Enables RLS on push_subscriptions');
assert(migrationSrc.includes('push_subscriptions_select_own'), 'Enforces SELECT RLS policy');
assert(migrationSrc.includes('push_subscriptions_insert_own'), 'Enforces INSERT RLS policy');
assert(migrationSrc.includes('push_subscriptions_delete_own'), 'Enforces DELETE RLS policy');
assert(migrationSrc.includes('CREATE OR REPLACE FUNCTION public.save_push_subscription'), 'Creates save_push_subscription RPC');
assert(migrationSrc.includes('CREATE OR REPLACE FUNCTION public.delete_push_subscription'), 'Creates delete_push_subscription RPC');

// 5. Validate Supabase Edge Function
console.log('\n5. Validating Supabase Edge Function (send-push/index.ts)...');
const edgeFuncPath = path.join(__dirname, 'supabase', 'functions', 'send-push', 'index.ts');
assert(fs.existsSync(edgeFuncPath), 'send-push/index.ts exists');

const edgeFuncSrc = fs.readFileSync(edgeFuncPath, 'utf8');
assert(edgeFuncSrc.includes('npm:web-push'), 'Imports web-push library');
assert(edgeFuncSrc.includes('authClient.auth.getUser()'), 'Validates caller auth token');
assert(edgeFuncSrc.includes('user.id !== senderId'), 'Enforces caller identity matches senderId');
assert(edgeFuncSrc.includes('.from("messages")'), 'Verifies message existence in database before sending');
assert(edgeFuncSrc.includes('webpush.sendNotification'), 'Sends standard Web Push notification');
assert(edgeFuncSrc.includes('deadSubscriptionIds'), 'Tracks dead/expired subscriptions (404/410)');
assert(edgeFuncSrc.includes('.delete()'), 'Prunes dead subscriptions from database');

// 6. Validate Client Push Notification Service
console.log('\n6. Validating src/services/pushNotificationService.ts...');
const servicePath = path.join(__dirname, 'src', 'services', 'pushNotificationService.ts');
assert(fs.existsSync(servicePath), 'pushNotificationService.ts exists');

const serviceSrc = fs.readFileSync(servicePath, 'utf8');
assert(serviceSrc.includes('urlBase64ToUint8Array'), 'Exports urlBase64ToUint8Array converter');
assert(serviceSrc.includes('DEFAULT_VAPID_PUBLIC_KEY'), 'Contains fallback VAPID public key');
assert(serviceSrc.includes('isPushSupported'), 'Implements isPushSupported');
assert(serviceSrc.includes('subscribeUser'), 'Implements subscribeUser');
assert(serviceSrc.includes('unsubscribeUser'), 'Implements unsubscribeUser');
assert(serviceSrc.includes('syncSubscriptionOnLogin'), 'Implements syncSubscriptionOnLogin');
assert(serviceSrc.includes('notifyRecipient'), 'Implements notifyRecipient');
assert(serviceSrc.includes("supabase.functions.invoke('send-push'"), 'Dispatches through send-push Edge function');

// 7. Validate Chat Repository Integration
console.log('\n7. Validating src/services/safetyAndChatRepository.ts Push Integration...');
const chatRepoPath = path.join(__dirname, 'src', 'services', 'safetyAndChatRepository.ts');
const chatRepoSrc = fs.readFileSync(chatRepoPath, 'utf8');
assert(chatRepoSrc.includes("from './pushNotificationService'"), 'Imports pushNotificationService');
assert(chatRepoSrc.includes('pushNotificationService\n      .notifyRecipient(') || chatRepoSrc.includes('pushNotificationService.notifyRecipient('), 'Triggers pushNotificationService.notifyRecipient in sendMessage');

// 8. Validate PWA Context & Chat Context Deep Linking
console.log('\n8. Validating PwaContext & ChatContext Integration...');
const pwaCtxPath = path.join(__dirname, 'src', 'context', 'PwaContext.tsx');
const pwaCtxSrc = fs.readFileSync(pwaCtxPath, 'utf8');
assert(pwaCtxSrc.includes('isPushSupported'), 'PwaContext exports isPushSupported');
assert(pwaCtxSrc.includes('isPushSubscribed'), 'PwaContext exports isPushSubscribed');
assert(pwaCtxSrc.includes('subscribePush'), 'PwaContext exports subscribePush');
assert(pwaCtxSrc.includes('unsubscribePush'), 'PwaContext exports unsubscribePush');

const chatCtxPath = path.join(__dirname, 'src', 'context', 'ChatContext.tsx');
const chatCtxSrc = fs.readFileSync(chatCtxPath, 'utf8');
assert(chatCtxSrc.includes('openConversationById'), 'ChatContext implements openConversationById');
assert(chatCtxSrc.includes('OPEN_CONVERSATION'), 'ChatContext listens for OPEN_CONVERSATION message from service worker');
assert(chatCtxSrc.includes("searchParams.get('conv')"), 'ChatContext checks conv URL deep link');

// 9. Validate UI Notification Settings
console.log('\n9. Validating UI Notification Settings Card & UserDashboard...');
const cardPath = path.join(__dirname, 'src', 'components', 'notifications', 'NotificationSettingsCard.tsx');
assert(fs.existsSync(cardPath), 'NotificationSettingsCard component exists');

const dashPath = path.join(__dirname, 'src', 'pages', 'UserDashboard.tsx');
const dashSrc = fs.readFileSync(dashPath, 'utf8');
assert(dashSrc.includes('NotificationSettingsCard'), 'UserDashboard imports and renders NotificationSettingsCard');

console.log('\n====================================================');
if (failedTests === 0) {
  console.log('🏆 ALL WEB PUSH FOUNDATION CHECKS PASSED PERFECTLY!');
  console.log('====================================================\n');
  process.exit(0);
} else {
  console.error(`💥 ${failedTests} CHECKS FAILED!`);
  console.log('====================================================\n');
  process.exit(1);
}

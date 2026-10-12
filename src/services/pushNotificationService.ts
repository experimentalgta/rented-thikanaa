// ========================================================================
// Renter Thikan PWA - Web Push Notification Service
// Standards-compliant Push API & VAPID subscription manager
// ========================================================================

import { supabase } from '../lib/supabase';

// RFC 8292 standard Base64URL-encoded P-256 Public VAPID Key
export const DEFAULT_VAPID_PUBLIC_KEY =
  'BJ469rJuWoOpUv6iKczWBxZF3WHvSXK6aRuiVUHWaM_Hzb6S2P5THqE202GtOGUMnpeaOAZJoMqh8Rp7RYBk7-o';

export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

export interface PushNotificationPayload {
  messageId?: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  senderName?: string;
  text?: string;
}

/**
 * Converts a Base64URL string to a Uint8Array for PushManager subscription
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class PushNotificationService {
  /**
   * Check if Web Push is supported by the client browser / platform
   */
  isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get current notification permission state
   */
  getPermissionState(): NotificationPermission | 'unsupported' {
    if (!this.isPushSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Retrieve active service worker registration
   */
  async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isPushSupported()) return null;
    try {
      return await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn('[PushService] Service worker ready check failed:', err);
      return null;
    }
  }

  /**
   * Get existing PushSubscription if one has already been registered
   */
  async getExistingSubscription(): Promise<PushSubscription | null> {
    const reg = await this.getServiceWorkerRegistration();
    if (!reg) return null;
    try {
      return await reg.pushManager.getSubscription();
    } catch (err) {
      console.warn('[PushService] Failed to get existing subscription:', err);
      return null;
    }
  }

  /**
   * Check if current browser is actively subscribed
   */
  async isSubscribed(): Promise<boolean> {
    const sub = await this.getExistingSubscription();
    return Boolean(sub);
  }

  /**
   * Enroll device for Web Push notifications
   */
  async subscribeUser(userId: string): Promise<{
    success: boolean;
    subscription?: PushSubscription;
    error?: string;
  }> {
    if (!this.isPushSupported()) {
      return { success: false, error: 'Web Push is not supported on this browser or platform.' };
    }

    if (!userId) {
      return { success: false, error: 'User ID is required to register push notifications.' };
    }

    try {
      // 1. Request notification permission if not yet granted
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }

      if (perm !== 'granted') {
        return {
          success: false,
          error:
            perm === 'denied'
              ? 'Notification permission was denied. Please allow notifications in your browser settings.'
              : 'Notification permission was dismissed.',
        };
      }

      // 2. Obtain service worker registration
      const reg = await this.getServiceWorkerRegistration();
      if (!reg) {
        return { success: false, error: 'Active service worker registration not available.' };
      }

      // 3. Subscribe or reuse existing subscription
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });
      }

      // 4. Save subscription to database
      await this.saveSubscriptionToDatabase(userId, subscription);

      return { success: true, subscription };
    } catch (err: any) {
      console.error('[PushService] Subscription failed:', err);
      return {
        success: false,
        error: err?.message || 'Failed to subscribe to Web Push notifications.',
      };
    }
  }

  /**
   * Unsubscribe device from Web Push
   */
  async unsubscribeUser(userId?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isPushSupported()) {
      return { success: false, error: 'Push not supported' };
    }

    try {
      const subscription = await this.getExistingSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        // Unsubscribe from browser push service
        await subscription.unsubscribe();

        // Remove from database
        await this.deleteSubscriptionFromDatabase(endpoint);
      }
      return { success: true };
    } catch (err: any) {
      console.warn('[PushService] Unsubscribe error:', err);
      return { success: false, error: err?.message };
    }
  }

  /**
   * Sync existing device subscription on user login
   */
  async syncSubscriptionOnLogin(userId: string): Promise<void> {
    if (!userId || !this.isPushSupported() || Notification.permission !== 'granted') {
      return;
    }

    try {
      const subscription = await this.getExistingSubscription();
      if (subscription) {
        await this.saveSubscriptionToDatabase(userId, subscription);
        if (import.meta.env.DEV) {
          console.log('[PushService] Synced push subscription for logged-in user:', userId);
        }
      }
    } catch (err) {
      console.warn('[PushService] Could not sync subscription on login:', err);
    }
  }

  /**
   * Persist subscription to Supabase via RPC or table upsert
   */
  private async saveSubscriptionToDatabase(
    userId: string,
    subscription: PushSubscription
  ): Promise<void> {
    if (!supabase) return;

    const subJson = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    if (!endpoint || !p256dh || !auth) {
      console.warn('[PushService] Subscription JSON missing essential keys:', subJson);
      return;
    }

    // Try RPC first
    try {
      const { error: rpcErr } = await supabase.rpc('save_push_subscription', {
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: userAgent,
      });

      if (!rpcErr) return;
    } catch {
      // Fallback to table upsert
    }

    // Fallback direct table upsert
    try {
      const { error: upsertErr } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

      if (upsertErr) {
        console.warn('[PushService] Database upsert warning:', upsertErr.message);
      }
    } catch (err) {
      console.warn('[PushService] Exception persisting push subscription:', err);
    }
  }

  /**
   * Delete subscription from Supabase
   */
  private async deleteSubscriptionFromDatabase(endpoint: string): Promise<void> {
    if (!supabase || !endpoint) return;

    try {
      // Try RPC first
      const { error: rpcErr } = await supabase.rpc('delete_push_subscription', {
        p_endpoint: endpoint,
      });

      if (!rpcErr) return;
    } catch {
      // Fallback
    }

    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
    } catch (err) {
      console.warn('[PushService] Exception removing subscription:', err);
    }
  }

  /**
   * Dispatch push notification to recipient through Supabase Edge Function
   * Non-blocking: will never throw or interrupt caller flow
   */
  async notifyRecipient(payload: PushNotificationPayload): Promise<{
    success: boolean;
    data?: any;
    error?: any;
  }> {
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: payload,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[PushService] Push notification dispatch warning:', error);
        }
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err: any) {
      // Gracefully handle offline or unconfigured edge functions
      if (import.meta.env.DEV) {
        console.warn('[PushService] Non-blocking push notification error:', err?.message || err);
      }
      return { success: false, error: err };
    }
  }
}

export const pushNotificationService = new PushNotificationService();

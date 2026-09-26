/**
 * Browser Web Notification API Utility
 * Provides cross-browser, safe handling of OS / Browser notifications.
 */

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return Notification.permission;
    }
  }

  return Notification.permission;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

interface ShowNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  onClick?: () => void;
}

export function showBrowserNotification(options: ShowNotificationOptions): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      tag: options.tag || 'app-message-notification',
      icon: options.icon || '/favicon.ico',
      badge: '/favicon.ico',
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // window.focus might be restricted in some environments
      }
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    // Auto close after 6 seconds
    setTimeout(() => {
      try {
        notification.close();
      } catch {
        // Ignore close error
      }
    }, 6000);

    return notification;
  } catch (err) {
    console.warn('[Notifications] Could not display browser notification:', err);
    return null;
  }
}

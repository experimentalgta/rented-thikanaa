import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission as requestNativeNotification,
} from '../utils/notifications';
import { useAuth } from './AuthContext';
import { pushNotificationService } from '../services/pushNotificationService';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isOnline: boolean;
  promptInstall: () => Promise<boolean>;
  dismissInstallPrompt: () => void;
  isInstallDismissed: boolean;
  showIosInstallModal: boolean;
  setShowIosInstallModal: (show: boolean) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotifications: () => Promise<NotificationPermission | 'unsupported'>;
  isNotificationDismissed: boolean;
  dismissNotificationPrompt: () => void;
  isFirstLaunchDismissed: boolean;
  dismissFirstLaunch: () => void;

  // Real Web Push Extensions
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  isPushLoading: boolean;
  subscribePush: () => Promise<boolean>;
  unsubscribePush: () => Promise<boolean>;
  refreshPushStatus: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

const INSTALL_DISMISSED_KEY = 'renter_thikan_pwa_install_dismissed_v1';
const NOTIFICATION_DISMISSED_KEY = 'renter_thikan_pwa_notif_dismissed_v1';
const FIRST_LAUNCH_DISMISSED_KEY = 'renter_thikan_pwa_first_launch_v1';

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  const [isIOS, setIsIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    const isApple =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    return isApple && !(window as any).MSStream;
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.navigator.onLine;
  });

  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(() => {
    try {
      const ts = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (!ts) return false;
      // Allow re-prompting after 7 days if previously dismissed
      const elapsed = Date.now() - parseInt(ts, 10);
      return elapsed < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  const [isNotificationDismissed, setIsNotificationDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NOTIFICATION_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isFirstLaunchDismissed, setIsFirstLaunchDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FIRST_LAUNCH_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Web Push states
  const [isPushSupported, setIsPushSupported] = useState<boolean>(() =>
    pushNotificationService.isPushSupported()
  );
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);

  const refreshPushStatus = useCallback(async () => {
    if (!pushNotificationService.isPushSupported()) {
      setIsPushSupported(false);
      setIsPushSubscribed(false);
      return;
    }
    setIsPushSupported(true);
    setNotificationPermission(pushNotificationService.getPermissionState());
    const subscribed = await pushNotificationService.isSubscribed();
    setIsPushSubscribed(subscribed);
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Track standalone display mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  // Listen for beforeinstallprompt & appinstalled
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      if (import.meta.env.DEV) {
        console.log('[PWA] beforeinstallprompt captured and ready for user trigger');
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      if (import.meta.env.DEV) {
        console.log('[PWA] Application successfully installed');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Check push subscription on load & sync on user login
  useEffect(() => {
    refreshPushStatus();
    if (currentUser?.id && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      pushNotificationService.syncSubscriptionOnLogin(currentUser.id).then(() => {
        refreshPushStatus();
      });
    }
  }, [currentUser?.id, refreshPushStatus]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setIsInstallable(false);
          return true;
        } else {
          return false;
        }
      } catch (err) {
        console.warn('[PWA] Error invoking native installation prompt:', err);
        return false;
      }
    } else if (isIOS && !isInstalled) {
      setShowIosInstallModal(true);
      return false;
    }
    return false;
  }, [deferredPrompt, isIOS, isInstalled]);

  const dismissInstallPrompt = useCallback(() => {
    setIsInstallDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
    } catch {}
  }, []);

  const subscribePush = useCallback(async (): Promise<boolean> => {
    if (!currentUser?.id) {
      return false;
    }
    setIsPushLoading(true);
    try {
      const res = await pushNotificationService.subscribeUser(currentUser.id);
      await refreshPushStatus();
      return res.success;
    } finally {
      setIsPushLoading(false);
    }
  }, [currentUser?.id, refreshPushStatus]);

  const unsubscribePush = useCallback(async (): Promise<boolean> => {
    setIsPushLoading(true);
    try {
      const res = await pushNotificationService.unsubscribeUser(currentUser?.id);
      await refreshPushStatus();
      return res.success;
    } finally {
      setIsPushLoading(false);
    }
  }, [currentUser?.id, refreshPushStatus]);

  const requestNotifications = useCallback(async (): Promise<
    NotificationPermission | 'unsupported'
  > => {
    const res = await requestNativeNotification();
    setNotificationPermission(res);
    if (res === 'granted' && currentUser?.id) {
      await pushNotificationService.subscribeUser(currentUser.id);
    }
    await refreshPushStatus();
    return res;
  }, [currentUser?.id, refreshPushStatus]);

  const dismissNotificationPrompt = useCallback(() => {
    setIsNotificationDismissed(true);
    try {
      localStorage.setItem(NOTIFICATION_DISMISSED_KEY, 'true');
    } catch {}
  }, []);

  const dismissFirstLaunch = useCallback(() => {
    setIsFirstLaunchDismissed(true);
    try {
      localStorage.setItem(FIRST_LAUNCH_DISMISSED_KEY, 'true');
    } catch {}
  }, []);

  return (
    <PwaContext.Provider
      value={{
        isInstallable: isInstallable || (isIOS && !isInstalled),
        isInstalled,
        isIOS,
        isOnline,
        promptInstall,
        dismissInstallPrompt,
        isInstallDismissed,
        showIosInstallModal,
        setShowIosInstallModal,
        notificationPermission,
        requestNotifications,
        isNotificationDismissed,
        dismissNotificationPrompt,
        isFirstLaunchDismissed,
        dismissFirstLaunch,

        // Push API
        isPushSupported,
        isPushSubscribed,
        isPushLoading,
        subscribePush,
        unsubscribePush,
        refreshPushStatus,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};

import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { Button } from '../common/Button';
import { showBrowserNotification } from '../../utils/notifications';

export const NotificationSettingsCard: React.FC = () => {
  const {
    isPushSupported,
    isPushSubscribed,
    isPushLoading,
    subscribePush,
    unsubscribePush,
    notificationPermission,
    refreshPushStatus,
  } = usePwa();

  const [testSent, setTestSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleTogglePush = async () => {
    setActionError(null);
    if (isPushSubscribed) {
      const ok = await unsubscribePush();
      if (!ok) {
        setActionError('Could not unsubscribe this device. Please try again.');
      }
    } else {
      const ok = await subscribePush();
      if (!ok) {
        if (notificationPermission === 'denied') {
          setActionError('Notification permission is blocked by your browser.');
        } else {
          setActionError('Failed to enable push notifications on this device.');
        }
      }
    }
  };

  const handleSendTestNotification = () => {
    setTestSent(true);
    showBrowserNotification({
      title: 'Rented Thikanaa Notifications Active! 🎉',
      body: 'Your device is configured to receive instant alerts when someone messages you.',
      tag: 'test-notification',
    });
    setTimeout(() => setTestSent(false), 4000);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 space-y-5 shadow-xs">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#101828] font-heading">
              Push Notifications &amp; Alerts
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Receive instant real-time message alerts even when the app is in the background or closed.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refreshPushStatus()}
          title="Refresh status"
          className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Unsupported notice */}
      {!isPushSupported && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Web Push Not Supported on this Browser</p>
            <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
              Your current browser does not support the Web Push API. For the best experience on mobile, add Rented Thikanaa to your home screen using Chrome on Android or Safari on iOS 16.4+.
            </p>
          </div>
        </div>
      )}

      {/* Permission Blocked notice */}
      {notificationPermission === 'denied' && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <BellOff className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Notifications Are Blocked in Browser Settings</span>
          </div>
          <p className="text-[11px] text-rose-800 leading-relaxed">
            To unblock: click the <strong>tune/padlock icon</strong> next to the URL in your browser address bar, locate <strong>Notifications</strong>, and change it to <strong>Allow</strong>. Then tap refresh above.
          </p>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Device Push Status</span>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isPushSubscribed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {isPushSubscribed ? 'Active & Subscribed' : 'Not Subscribed'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">OS Permission</span>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              notificationPermission === 'granted'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : notificationPermission === 'denied'
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {notificationPermission === 'granted'
              ? 'Granted'
              : notificationPermission === 'denied'
              ? 'Blocked'
              : 'Default (Not requested)'}
          </span>
        </div>
      </div>

      {/* Controls & Actions */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#F1F5F9]">
        <div className="text-[11px] text-[#667085]">
          {isPushSubscribed ? (
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              This device will wake up and alert you when new messages arrive.
            </span>
          ) : (
            <span>Enable notifications to never miss inquiries from student tenants or landlords.</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPushSubscribed && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTestNotification}
              disabled={testSent}
              className="text-xs"
            >
              {testSent ? 'Alert Dispatched!' : 'Send Test Alert'}
            </Button>
          )}

          <Button
            variant={isPushSubscribed ? 'outline' : 'primary'}
            size="sm"
            onClick={handleTogglePush}
            disabled={isPushLoading || (!isPushSupported && !isPushSubscribed)}
            className="text-xs font-bold"
          >
            {isPushLoading
              ? 'Processing...'
              : isPushSubscribed
              ? 'Disable on this Device'
              : 'Enable Push Notifications'}
          </Button>
        </div>
      </div>
    </div>
  );
};

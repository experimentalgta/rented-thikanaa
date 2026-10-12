import React, { useState } from 'react';
import { Bell, X, CheckCircle, ShieldAlert } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

interface NotificationPromptProps {
  className?: string;
  variant?: 'card' | 'banner';
}

export const NotificationPrompt: React.FC<NotificationPromptProps> = ({
  className = '',
  variant = 'card',
}) => {
  const {
    notificationPermission,
    requestNotifications,
    isNotificationDismissed,
    dismissNotificationPrompt,
  } = usePwa();

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<'granted' | 'denied' | null>(null);

  // If already granted, denied, unsupported or dismissed by user, do not render
  if (
    notificationPermission === 'granted' ||
    notificationPermission === 'denied' ||
    notificationPermission === 'unsupported' ||
    isNotificationDismissed
  ) {
    return null;
  }

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const result = await requestNotifications();
      if (result === 'granted') {
        setFeedback('granted');
        setTimeout(() => {
          dismissNotificationPrompt();
        }, 2000);
      } else if (result === 'denied') {
        setFeedback('denied');
        setTimeout(() => {
          dismissNotificationPrompt();
        }, 2500);
      } else {
        dismissNotificationPrompt();
      }
    } catch {
      dismissNotificationPrompt();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    dismissNotificationPrompt();
  };

  if (feedback === 'granted') {
    return (
      <div className={`flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs sm:text-sm font-medium ${className}`}>
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Notifications enabled! You will receive room &amp; chat updates.</span>
      </div>
    );
  }

  if (feedback === 'denied') {
    return (
      <div className={`flex items-center gap-2 p-3 bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 text-xs font-medium ${className}`}>
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
        <span>Notifications are blocked in your browser settings.</span>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <aside
        aria-label="Notification permission prompt"
        className={`bg-slate-900 text-white p-3 rounded-2xl shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-xs sm:text-sm font-semibold">Stay updated on room inquiries</p>
            <p className="text-xs text-slate-400">Get alerts when hosts reply to your messages.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Enabling...' : 'Enable Alerts'}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Notification permission card"
      className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-4 rounded-2xl shadow-xl border border-slate-700/60 relative overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification prompt"
        className="absolute top-3 right-3 p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 mb-3 pr-6">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-white">Never miss a host reply</h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Turn on notifications to get alerted immediately when property owners reply to your inquiry or confirm your visit.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/60 justify-end">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={isLoading}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoading ? 'Requesting...' : 'Enable Notifications'}
        </button>
      </div>
    </aside>
  );
};

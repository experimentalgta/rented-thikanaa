import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePwa();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
    } else if (wasOfflineRef.current) {
      // Transitioned from offline to online
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        wasOfflineRef.current = false;
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[70] bg-slate-900/95 text-amber-300 border-b border-amber-500/30 px-3 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 backdrop-blur-md shadow-lg transition-all animate-in slide-in-from-top-2"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}
      >
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <span>
          <strong className="font-semibold text-white">Offline mode active.</strong> You can browse previously loaded rooms and listings.
        </span>
      </aside>
    );
  }

  if (showReconnected) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[70] bg-emerald-600 text-white px-3 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-lg transition-all animate-in slide-in-from-top-2"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}
      >
        <Wifi className="w-4 h-4 text-white shrink-0" />
        <span>Connected! Synchronizing live room updates...</span>
      </aside>
    );
  }

  return null;
};

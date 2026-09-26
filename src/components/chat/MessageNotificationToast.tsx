import React, { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { MessageSquare, X, ArrowRight, Home } from 'lucide-react';

export const MessageNotificationToast: React.FC = () => {
  const { incomingToast, dismissToast, conversations, selectConversation, setIsChatModalOpen } = useChat();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!incomingToast) return;

    // Auto-dismiss after 6 seconds
    timerRef.current = setTimeout(() => {
      dismissToast();
    }, 6000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [incomingToast, dismissToast]);

  if (!incomingToast) return null;

  const handleClick = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    dismissToast();

    // Find target conversation or construct temporary one
    const targetConv = conversations.find((c) => c.id === incomingToast.conversationId);
    if (targetConv) {
      await selectConversation(targetConv);
    }
    setIsChatModalOpen(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    dismissToast();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      onClick={handleClick}
      onMouseEnter={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onMouseLeave={() => {
        timerRef.current = setTimeout(() => {
          dismissToast();
        }, 3000);
      }}
      className="fixed top-4 right-4 z-[99999] w-[calc(100vw-2rem)] max-w-sm sm:max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-emerald-500/30 transition-all duration-300 hover:shadow-emerald-500/10 hover:border-emerald-500/50 cursor-pointer animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-start gap-3">
        {/* Avatar or Icon */}
        <div className="relative shrink-0">
          {incomingToast.senderAvatar ? (
            <img
              src={incomingToast.senderAvatar}
              alt={incomingToast.senderName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm ring-2 ring-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
          )}
          {/* Glowing live dot */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {incomingToast.senderName}
            </h4>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full shrink-0">
              New Message
            </span>
          </div>

          {incomingToast.propertyTitle && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              <Home className="w-3 h-3 shrink-0" />
              <span className="truncate">{incomingToast.propertyTitle}</span>
            </div>
          )}

          <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate mt-1">
            {incomingToast.text}
          </p>

          <div className="flex items-center gap-2 mt-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              Click to reply <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 -mr-1 -mt-1"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

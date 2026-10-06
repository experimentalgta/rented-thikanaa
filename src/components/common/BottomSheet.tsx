import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  // Lock background window and body scrolling completely on mobile & desktop
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalBodyTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.touchAction = originalBodyTouchAction;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      {/* Backdrop: captures background touch events to prevent page scrolling */}
      <div
        className="fixed inset-0 bg-[#101828]/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        onTouchMove={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      {/* Drawer Container: full bounded height on mobile, cleanly above mobile nav */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 max-h-[92dvh] h-[90dvh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden overscroll-contain animate-in slide-in-from-bottom duration-200"
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden shrink-0 bg-white">
          <div className="w-12 h-1.5 bg-[#CBD5E1] rounded-full" />
        </div>

        {/* Header (Sticky top) */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-[#F1F5F9] shrink-0 bg-white">
          <h3 className="text-base font-bold text-[#111827] font-heading">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#111827] rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Independent touch scroll with momentum scrolling */}
        <div
          className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {/* Sticky Footer: Always pinned and immediately reachable */}
        {footer && (
          <div className="p-4 sm:p-5 bg-white border-t border-[#F1F5F9] shrink-0 z-20 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

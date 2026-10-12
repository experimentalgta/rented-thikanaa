import React from 'react';
import { Share, PlusSquare, X, Smartphone, ArrowDown } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { BrandLogo } from '../common/BrandLogo';

export const IosInstallModal: React.FC = () => {
  const { showIosInstallModal, setShowIosInstallModal } = usePwa();

  if (!showIosInstallModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in slide-in-from-bottom-5 duration-200"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <h3 id="ios-install-title" className="font-bold text-base text-slate-900 font-heading">
                Install Renter Thikan
              </h3>
              <p className="text-xs text-slate-500">For iPhone &amp; iPad Safari</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowIosInstallModal(false)}
            aria-label="Close instructions"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Install the Renter Thikan Progressive Web App to your home screen for full-screen browsing, faster listing loading, and instant accommodation updates.
        </p>

        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              1
            </div>
            <div className="text-xs text-slate-700">
              <span>Tap the </span>
              <span className="inline-flex items-center gap-1 font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 mx-0.5">
                <Share className="w-3.5 h-3.5" /> Share
              </span>
              <span> button in Safari&apos;s bottom toolbar.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              2
            </div>
            <div className="text-xs text-slate-700">
              <span>Scroll down and select </span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300 mx-0.5">
                <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
              </span>
              <span>.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
              3
            </div>
            <div className="text-xs text-slate-700">
              <span>Tap </span>
              <strong className="text-emerald-700 font-bold">Add</strong>
              <span> in the top right corner. The app icon will appear directly on your home screen.</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowIosInstallModal(false)}
          className="w-full py-2.5 px-4 bg-[#101828] text-white font-semibold text-xs sm:text-sm rounded-xl hover:bg-[#1E293B] transition-colors cursor-pointer"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Sparkles, Download, MapPin, Bell, X, ArrowRight } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { BrandLogo } from '../common/BrandLogo';

interface FirstLaunchOnboardingProps {
  onExplore?: () => void;
  className?: string;
}

export const FirstLaunchOnboarding: React.FC<FirstLaunchOnboardingProps> = ({
  onExplore,
  className = '',
}) => {
  const {
    isFirstLaunchDismissed,
    dismissFirstLaunch,
    isInstallable,
    isInstalled,
    promptInstall,
  } = usePwa();

  // If already dismissed or already installed in standalone mode, do not show
  if (isFirstLaunchDismissed || isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    await promptInstall();
  };

  const handleDismiss = () => {
    dismissFirstLaunch();
  };

  return (
    <section
      aria-label="Welcome to Renter Thikan"
      className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#101828] to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-amber-500/20 mb-6 ${className}`}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss welcome guide"
        className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to Renter Thikan</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-heading">
            Your Progressive Web App for Student Accommodation
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
            Find student rooms, PGs, and shared flats near your coaching classes and institutes. Direct host chats, zero brokerage, and instant updates.
          </p>

          {/* 3 Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Download className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Install for offline &amp; quick access</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Find rooms near your institute</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-200 font-medium">Direct chat with verified hosts</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-row sm:flex-col items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
          {isInstallable && (
            <button
              type="button"
              onClick={handleInstall}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              handleDismiss();
              if (onExplore) onExplore();
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Explore Rooms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};

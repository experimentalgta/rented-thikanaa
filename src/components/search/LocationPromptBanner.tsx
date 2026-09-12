import React from 'react';
import { MapPin, Navigation, X, Loader2, AlertCircle } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';
import { Button } from '../common/Button';

interface LocationPromptBannerProps {
  className?: string;
  onSuccess?: () => void;
}

export const LocationPromptBanner: React.FC<LocationPromptBannerProps> = ({
  className = '',
  onSuccess,
}) => {
  const {
    userLocation,
    permissionState,
    isDetecting,
    error,
    detectCurrentLocation,
    isPromptDismissed,
    dismissPrompt,
  } = useLocation();

  // Hide if dismissed, location already set via GPS, or unsupported/denied
  if (isPromptDismissed || userLocation.source === 'gps' || permissionState === 'unsupported') {
    return null;
  }

  const handleUseLocation = async () => {
    const loc = await detectCurrentLocation();
    if (loc && onSuccess) {
      onSuccess();
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#101828] text-white p-4 sm:p-5 shadow-lg border border-white/10 ${className}`}
      role="region"
      aria-label="Location permission recommendation"
    >
      {/* Decorative Warm Amber accent dot */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#F59E0B]/10 rounded-full blur-xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0 mt-0.5 border border-[#F59E0B]/30">
            {isDetecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5 text-[#F59E0B]" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white font-heading flex items-center gap-2">
              <span>Find rooms near you</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full border border-[#F59E0B]/20">
                Optional
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 leading-relaxed max-w-xl">
              Allow location access to discover student housing and PGs sorted naturally by distance from where you are right now.
            </p>

            {error && (
              <div className="mt-2 text-xs text-amber-300 flex items-center gap-1.5 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleUseLocation}
                disabled={isDetecting}
                loading={isDetecting}
                icon={<MapPin className="w-3.5 h-3.5" />}
                className="font-semibold text-xs"
              >
                {isDetecting ? 'Detecting your location...' : 'Use My Location'}
              </Button>

              <button
                type="button"
                onClick={dismissPrompt}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>

        {/* Dismiss 'X' Button */}
        <button
          type="button"
          onClick={dismissPrompt}
          className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          aria-label="Dismiss location suggestion"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

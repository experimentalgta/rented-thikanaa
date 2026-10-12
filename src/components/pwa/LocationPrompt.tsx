import React from 'react';
import { MapPin, Navigation, X, Loader2 } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';

interface LocationPromptProps {
  className?: string;
  variant?: 'card' | 'compact';
}

export const LocationPrompt: React.FC<LocationPromptProps> = ({
  className = '',
  variant = 'card',
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

  // If location is already known via GPS or manual, or prompt is dismissed, or permission denied/unsupported, hide
  if (
    Boolean(userLocation.latitude && userLocation.longitude) ||
    isPromptDismissed ||
    permissionState === 'denied' ||
    permissionState === 'unsupported'
  ) {
    return null;
  }

  const handleUseLocation = async () => {
    await detectCurrentLocation({ forceFresh: true });
  };

  if (variant === 'compact') {
    return (
      <div
        className={`bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-md border border-slate-800 ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-slate-300 truncate">
            Enable GPS to see rooms closest to your college
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={dismissPrompt}
            aria-label="Dismiss location request"
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={isDetecting}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            {isDetecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Navigation className="w-3 h-3" />
            )}
            <span>Locate</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Location permission request"
      className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 relative overflow-hidden text-slate-900 ${className}`}
    >
      <button
        type="button"
        onClick={dismissPrompt}
        aria-label="Dismiss location request"
        className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3.5 mb-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
          <MapPin className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-900">Find Rooms Near You</h4>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            Allow location access to sort student accommodations, PGs, and hostels by walking distance from your current institute or coaching area.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 justify-end">
        <button
          type="button"
          onClick={dismissPrompt}
          className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer font-medium"
        >
          Select City Manually
        </button>
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={isDetecting}
          className="px-4 py-2 bg-[#101828] hover:bg-[#1E293B] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isDetecting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Finding Nearby...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
              <span>Use My Location</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

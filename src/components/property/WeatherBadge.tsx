import React, { useEffect, useState } from 'react';
import { Sun, CloudRain, Snowflake, Wind, Thermometer } from 'lucide-react';
import { fetchLocalWeather, WeatherData } from '../../services/weatherService';

interface WeatherBadgeProps {
  latitude?: number;
  longitude?: number;
  locality?: string;
}

export const WeatherBadge: React.FC<WeatherBadgeProps> = ({
  latitude,
  longitude,
  locality,
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!latitude || !longitude) return;

    fetchLocalWeather(latitude, longitude)
      .then((data) => {
        if (isMounted) {
          setWeather(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  if (!weather) return null;

  const getIcon = () => {
    switch (weather.advisoryType) {
      case 'heat':
        return <Sun className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'cold':
        return <Snowflake className="w-4 h-4 text-sky-500 shrink-0" />;
      case 'rain':
        return <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />;
      default:
        return <Wind className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
  };

  const getBgColor = () => {
    switch (weather.advisoryType) {
      case 'heat':
        return 'bg-amber-50/70 border-amber-200 text-amber-900';
      case 'cold':
        return 'bg-sky-50/70 border-sky-200 text-sky-900';
      case 'rain':
        return 'bg-blue-50/70 border-blue-200 text-blue-900';
      default:
        return 'bg-emerald-50/70 border-emerald-200 text-emerald-900';
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${getBgColor()} text-xs transition-all`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-2xs">
          {getIcon()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-bold">
            <span>{weather.temperature}°C</span>
            <span className="text-[11px] font-medium opacity-75">
              • {weather.condition}
              {locality ? ` in ${locality}` : ''}
            </span>
          </div>
          <p className="text-[11px] opacity-85 truncate">{weather.advisory}</p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold bg-white/80 px-2 py-1 rounded-lg shrink-0">
        <Thermometer className="w-3 h-3 text-slate-500" />
        <span>Feels {weather.feelsLike}°C</span>
      </div>
    </div>
  );
};

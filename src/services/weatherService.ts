/**
 * Weather & Climate Intelligence Service
 * Source: Open-Meteo Public API (public-apis directory)
 * 100% Free, Open Source, No API Key required, CORS Enabled
 */

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  windSpeed: number;
  advisory: string;
  advisoryType: 'heat' | 'cold' | 'pleasant' | 'rain';
}

const WMO_CODE_MAP: Record<number, string> = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing Rime Fog',
  51: 'Light Drizzle',
  53: 'Moderate Drizzle',
  55: 'Dense Drizzle',
  61: 'Slight Rain',
  63: 'Moderate Rain',
  65: 'Heavy Rain',
  80: 'Passing Showers',
  81: 'Moderate Showers',
  82: 'Violent Showers',
  95: 'Thunderstorm',
};

// In-memory cache to prevent redundant fetches
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function fetchLocalWeather(
  latitude?: number,
  longitude?: number,
  signal?: AbortSignal
): Promise<WeatherData | null> {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  // Rounded coordinate cache key (~1.1 km precision)
  const cacheKey = `${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = await res.json();
    const cur = json.current;
    if (!cur) return null;

    const temp = Math.round(cur.temperature_2m);
    const feelsLike = Math.round(cur.apparent_temperature ?? cur.temperature_2m);
    const humidity = Math.round(cur.relative_humidity_2m ?? 50);
    const weatherCode = cur.weather_code ?? 0;
    const condition = WMO_CODE_MAP[weatherCode] || 'Pleasant';
    const isDay = Boolean(cur.is_day);
    const windSpeed = Math.round(cur.wind_speed_10m ?? 0);

    // Contextual student advisory for Indian academic hubs (Prayagraj / UP)
    let advisory = 'Pleasant weather for studying in this locality.';
    let advisoryType: WeatherData['advisoryType'] = 'pleasant';

    if (temp >= 34 || feelsLike >= 36) {
      advisory = `High summer heat (${temp}°C). Check for room Air Cooler or AC facility.`;
      advisoryType = 'heat';
    } else if (temp <= 15) {
      advisory = `Chilly weather (${temp}°C). Hot water / geyser facility recommended.`;
      advisoryType = 'cold';
    } else if (cur.precipitation > 0 || [61, 63, 65, 80, 81, 82].includes(weatherCode)) {
      advisory = 'Rainy weather in this locality today.';
      advisoryType = 'rain';
    }

    const data: WeatherData = {
      temperature: temp,
      feelsLike,
      humidity,
      weatherCode,
      condition,
      isDay,
      windSpeed,
      advisory,
      advisoryType,
    };

    weatherCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch {
    // Fail silently on network drops
    return null;
  }
}

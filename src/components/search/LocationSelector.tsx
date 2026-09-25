import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin,
  Search,
  Building,
  GraduationCap,
  X,
  ChevronDown,
  Navigation,
  Loader2,
  AlertCircle,
  Check,
  Compass,
  Layers,
  History,
  Clock,
  Sparkles
} from 'lucide-react';
import { locationRepository, LocationSearchResult } from '../../services/locationRepository';
import { useLocation } from '../../context/LocationContext';
import { State, District, City, LocalityInfo, LocationData } from '../../types';

interface LocationSelectorProps {
  selectedLocality: string;
  onSelect: (localityName: string, lat?: number, lng?: number, cityName?: string, districtName?: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface RecentLocationItem {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  type: 'locality' | 'city';
}

const RECENT_STORAGE_KEY = 'rt_recent_locations_v1';

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocality,
  onSelect,
  className = '',
  size = 'md',
}) => {
  const {
    userLocation,
    isDetecting,
    error: locError,
    detectCurrentLocation,
    setManualLocation,
    clearLocation,
  } = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(selectedLocality || '');
  const [activeTab, setActiveTab] = useState<'search' | 'hierarchy'>('search');
  const [asyncResults, setAsyncResults] = useState<LocationSearchResult[]>([]);
  const [isSearchingAsync, setIsSearchingAsync] = useState(false);

  // Recent searches
  const [recentLocations, setRecentLocations] = useState<RecentLocationItem[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Hierarchy Selection State
  const [selectedStateCode, setSelectedStateCode] = useState<string>('UP');
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>('prayagraj');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const saveRecentLocation = (item: RecentLocationItem) => {
    try {
      const updated = [item, ...recentLocations.filter((r) => r.id !== item.id)].slice(0, 5);
      setRecentLocations(updated);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Sync display with userLocation or selectedLocality
  useEffect(() => {
    if (userLocation.source === 'gps' && userLocation.displayName) {
      setQuery(userLocation.displayName);
    } else if (userLocation.source === 'manual' && userLocation.displayName) {
      setQuery(userLocation.displayName);
    } else {
      setQuery(selectedLocality || '');
    }
  }, [selectedLocality, userLocation.source, userLocation.displayName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search with AbortController
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setAsyncResults([]);
      setIsSearchingAsync(false);
      return;
    }

    // 1. Immediate synchronous local search
    const localMatches = locationRepository.searchLocations(q);
    setAsyncResults(localMatches);

    // 2. Debounce async provider call if query is longer
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsSearchingAsync(true);
      try {
        const liveMatches = await locationRepository.searchLocationsAsync(q, controller.signal);
        if (liveMatches && liveMatches.length > 0) {
          const mapped: LocationSearchResult[] = liveMatches.map((m, idx) => ({
            id: `async-${idx}-${m.latitude.toFixed(3)}`,
            title: m.locality || m.city || q,
            subtitle: m.formattedAddress || `${m.city || ''}, ${m.state || 'India'}`,
            type: m.locality ? 'locality' : 'city',
            state: m.state || 'India',
            state_code: m.stateCode || '',
            district: m.district,
            city: m.city || 'India',
            city_slug: m.citySlug || '',
            locality: m.locality,
            locality_slug: m.localitySlug,
            latitude: m.latitude,
            longitude: m.longitude,
            formatted_address: m.formattedAddress,
          }));
          setAsyncResults((prev) => {
            const seen = new Set(prev.map((p) => `${p.latitude.toFixed(3)}_${p.longitude.toFixed(3)}`));
            const fresh = mapped.filter((p) => !seen.has(`${p.latitude.toFixed(3)}_${p.longitude.toFixed(3)}`));
            return [...prev, ...fresh].slice(0, 15);
          });
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          // ignore
        }
      } finally {
        setIsSearchingAsync(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleUseCurrentLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const detected = await detectCurrentLocation();
    if (detected) {
      onSelect(detected.locality, detected.latitude, detected.longitude, detected.city, detected.district);
      setQuery(detected.displayName);
      setIsOpen(false);
      saveRecentLocation({
        id: `recent-gps-${Date.now()}`,
        name: detected.locality,
        city: detected.city || 'India',
        state: detected.state || 'India',
        latitude: detected.latitude!,
        longitude: detected.longitude!,
        type: 'locality',
      });
    }
  };

  const handleSelectSearchResult = (result: LocationSearchResult) => {
    const primaryName = result.locality || result.city;
    setManualLocation(
      primaryName,
      result.latitude,
      result.longitude,
      result.city,
      result.state,
      'search',
      result.district
    );
    onSelect(primaryName, result.latitude, result.longitude, result.city, result.district);
    setQuery(result.locality ? `${result.locality}, ${result.city}` : result.city);
    setIsOpen(false);
    saveRecentLocation({
      id: result.id,
      name: primaryName,
      city: result.city,
      state: result.state,
      latitude: result.latitude,
      longitude: result.longitude,
      type: result.type === 'locality' ? 'locality' : 'city',
    });
  };

  const handleSelectCityQuick = (city: City) => {
    setManualLocation(city.name, city.latitude, city.longitude, city.name, city.state_name, 'search', city.district);
    onSelect(city.name, city.latitude, city.longitude, city.name, city.district);
    setQuery(`${city.name}, ${city.state_code}`);
    setIsOpen(false);
    saveRecentLocation({
      id: `city-${city.id}`,
      name: city.name,
      city: city.name,
      state: city.state_name,
      latitude: city.latitude,
      longitude: city.longitude,
      type: 'city',
    });
  };

  const handleSelectLocalityDirect = (loc: LocalityInfo) => {
    setManualLocation(loc.name, loc.latitude, loc.longitude, loc.city_name, loc.state_name, 'search', loc.district);
    onSelect(loc.name, loc.latitude, loc.longitude, loc.city_name, loc.district);
    setQuery(`${loc.name}, ${loc.city_name}`);
    setIsOpen(false);
    saveRecentLocation({
      id: `loc-${loc.id}`,
      name: loc.name,
      city: loc.city_name,
      state: loc.state_name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      type: 'locality',
    });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearLocation();
    setQuery('');
    onSelect('');
    setIsOpen(true);
  };

  // Hierarchy Data
  const allStates: State[] = useMemo(() => locationRepository.getStates(), []);
  const citiesInState: City[] = useMemo(
    () => locationRepository.getCities(selectedStateCode),
    [selectedStateCode]
  );
  const localitiesInCity: LocalityInfo[] = useMemo(
    () => locationRepository.getLocalities(selectedCitySlug),
    [selectedCitySlug]
  );
  const popularCities = useMemo(() => locationRepository.getPopularCities(), []);

  const sizeStyles = {
    sm: 'h-10 text-xs px-3',
    md: 'h-12 text-sm px-4',
    lg: 'h-14 sm:h-16 text-base px-4 sm:px-5',
  };

  const isGpsActive = userLocation.source === 'gps';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Search Input Box */}
      <div
        className={`flex items-center gap-3 bg-slate-900/90 md:bg-white border border-slate-700 md:border-[#E5E7EB] hover:border-slate-600 md:hover:border-[#CBD5E1] focus-within:border-[#F59E0B] focus-within:ring-2 focus-within:ring-[#F59E0B]/20 rounded-2xl shadow-xs transition-all cursor-pointer ${sizeStyles[size]}`}
        onClick={() => setIsOpen(true)}
      >
        {isDetecting ? (
          <Loader2 className="w-5 h-5 text-[#F59E0B] animate-spin shrink-0" />
        ) : isGpsActive ? (
          <Navigation className="w-5 h-5 text-[#D97706] shrink-0" />
        ) : (
          <MapPin className="w-5 h-5 text-[#F59E0B] shrink-0" />
        )}

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveTab('search');
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            isDetecting
              ? 'Detecting your location in India...'
              : 'Search City, Area, Locality or Landmark across India...'
          }
          className="w-full bg-transparent border-none text-white md:text-[#111827] placeholder:text-slate-400 md:placeholder:text-[#94A3B8] focus:outline-none font-medium truncate text-sm sm:text-base"
        />

        {isGpsActive && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] shrink-0">
            GPS Active
          </span>
        )}

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-white md:text-[#94A3B8] md:hover:text-[#111827] rounded-full transition-colors"
            title="Clear location"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
        )}
      </div>

      {/* Autocomplete & Location Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] max-h-[480px] overflow-y-auto z-50 p-2 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Action 1: Use Current Location (GPS) */}
          <div className="p-1.5 border-b border-[#F1F5F9]">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isDetecting}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                isGpsActive
                  ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                  : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#101828]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#101828] text-[#F59E0B] flex items-center justify-center shrink-0 shadow-xs">
                  {isDetecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                    <span>{isDetecting ? 'Detecting your location...' : '📍 Use My Current Location'}</span>
                    {isGpsActive && (
                      <span className="text-[10px] font-semibold text-[#D97706]">(Active)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    {isGpsActive && userLocation.displayName
                      ? `${userLocation.displayName} • ${userLocation.accuracyLabel || 'GPS'}`
                      : 'Auto-detect State → City → Locality using device GPS'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#D97706] shrink-0 px-2 py-1 rounded-lg bg-amber-500/10">
                {isDetecting ? 'Locating...' : 'Detect'}
              </span>
            </button>

            {/* Inline Error Notice or Low Accuracy Warning */}
            {locError && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#92400E] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                <div className="leading-snug">{locError}</div>
              </div>
            )}
          </div>

          {/* Selector Navigation Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] rounded-xl my-2 border border-[#E2E8F0] text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'search'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-[#64748B] hover:text-[#101828]'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Search &amp; Popular Hubs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hierarchy')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'hierarchy'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-[#64748B] hover:text-[#101828]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Browse State &rarr; City &rarr; Area</span>
            </button>
          </div>

          {/* TAB 1: Search & Popular Locations */}
          {activeTab === 'search' && (
            <div className="space-y-3 p-1">
              {/* Autocomplete Results if query typed */}
              {query.trim().length >= 2 ? (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                    <span>Matching Locations Across India</span>
                    {isSearchingAsync && <Loader2 className="w-3 h-3 animate-spin text-[#F59E0B]" />}
                  </div>
                  {asyncResults.length > 0 ? (
                    asyncResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSelectSearchResult(result)}
                        className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F8FAFC] transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] group-hover:bg-[#FFFBEB] group-hover:text-[#D97706] text-[#64748B] flex items-center justify-center shrink-0 mt-0.5">
                          {result.type === 'city' ? (
                            <Building className="w-3.5 h-3.5" />
                          ) : result.type === 'landmark' ? (
                            <GraduationCap className="w-3.5 h-3.5" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-[#101828] truncate">
                            {result.title}
                          </div>
                          <div className="text-[11px] text-[#64748B] truncate">
                            {result.subtitle}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-[#F1F5F9] text-[#64748B] shrink-0">
                          {result.type}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-[#94A3B8]">
                      No exact matches found for "{query}". You can browse by State &rarr; City &rarr; Area tab.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Recent Searches (if any) */}
                  {recentLocations.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[#F59E0B]" />
                        <span>Recent Locations</span>
                      </div>
                      <div className="space-y-0.5">
                        {recentLocations.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setManualLocation(item.name, item.latitude, item.longitude, item.city, item.state);
                              onSelect(item.name, item.latitude, item.longitude, item.city);
                              setQuery(`${item.name}, ${item.city}`);
                              setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              <History className="w-3.5 h-3.5 text-[#94A3B8]" />
                              <div>
                                <span className="text-xs font-bold text-[#101828]">{item.name}</span>
                                <span className="text-[11px] text-[#64748B] ml-1.5">({item.city}, {item.state})</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-[#94A3B8] font-semibold">Select</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Indian Cities Quick Chips */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                      <span>Popular Cities in India</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-1">
                      {popularCities.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCityQuick(c)}
                          className="flex items-center justify-between p-2 rounded-xl border border-[#E2E8F0] hover:border-[#F59E0B] hover:bg-[#FFFBEB] transition-all text-left group"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#101828] group-hover:text-[#92400E] truncate">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-[#64748B] truncate">{c.state_code}</div>
                          </div>
                          <Building className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#F59E0B] shrink-0 ml-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: State -> City -> Locality Hierarchy */}
          {activeTab === 'hierarchy' && (
            <div className="p-2 space-y-3">
              {/* 1. State Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                  1. Select State / UT
                </label>
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    const cities = locationRepository.getCities(e.target.value);
                    if (cities.length > 0) {
                      setSelectedCitySlug(cities[0].slug);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#101828] focus:outline-none focus:border-[#F59E0B]"
                >
                  {allStates.map((st) => (
                    <option key={st.id} value={st.code}>
                      {st.name} ({st.code}) {st.type === 'ut' ? '• UT' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. City Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                  2. Select City / Hub
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  {citiesInState.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => setSelectedCitySlug(city.slug)}
                      className={`p-2 rounded-lg text-left text-xs font-bold transition-all ${
                        selectedCitySlug === city.slug
                          ? 'bg-[#101828] text-[#F59E0B] shadow-xs'
                          : 'hover:bg-white text-[#101828]'
                      }`}
                    >
                      <div className="truncate">{city.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Locality Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                  3. Select Locality / Area in {locationRepository.getCityBySlugOrName(selectedCitySlug)?.name || 'City'}
                </label>
                {localitiesInCity.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto p-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    {localitiesInCity.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleSelectLocalityDirect(loc)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white hover:border-[#F59E0B] border border-transparent transition-all text-left group"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#101828] group-hover:text-[#92400E]">
                            {loc.name} {loc.hindi_name ? `(${loc.hindi_name})` : ''}
                          </div>
                          {loc.popular_for && (
                            <div className="text-[10px] text-[#64748B] truncate max-w-[240px]">
                              {loc.popular_for}
                            </div>
                          )}
                        </div>
                        <MapPin className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#F59E0B] shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-center text-xs text-[#64748B]">
                    No pre-listed areas for this city. Select the entire city center:
                    <button
                      type="button"
                      onClick={() => {
                        const ct = locationRepository.getCityBySlugOrName(selectedCitySlug);
                        if (ct) handleSelectCityQuick(ct);
                      }}
                      className="mt-2 block mx-auto px-3 py-1.5 rounded-lg bg-[#101828] text-[#F59E0B] font-bold text-xs"
                    >
                      Use {locationRepository.getCityBySlugOrName(selectedCitySlug)?.name}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

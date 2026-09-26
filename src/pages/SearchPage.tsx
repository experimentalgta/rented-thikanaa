import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SlidersHorizontal,
  Map,
  List,
  MapPin,
  RotateCw,
  Navigation,
  AlertTriangle,
  Compass,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { ChangeLocationModal } from '../components/search/ChangeLocationModal';
import { FilterSidebar } from '../components/search/FilterSidebar';
import { PropertyCard } from '../components/property/PropertyCard';
import { CompactPropertyCard } from '../components/property/CompactPropertyCard';
import { PropertyMap } from '../components/map/PropertyMap';
import { BottomSheet } from '../components/common/BottomSheet';
import { Button } from '../components/common/Button';
import {
  Property,
  PropertySearchParams,
  SearchResultSummary,
  ProximityBucket
} from '../types';
import { propertyRepository, DEFAULT_SEARCH_RADIUS_KM } from '../services/propertyRepository';
import { locationService } from '../services/location/locationService';
import { locationRepository } from '../services/locationRepository';
import { PROXIMITY_BUCKET_LABELS } from '../utils/geo';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';

interface SearchPageProps {
  initialLocality?: string;
  initialPropertyType?: string;
  onSelectProperty: (property: Property) => void;
  onNavigate?: (view: string, param?: any) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialLocality = '',
  initialPropertyType,
  onSelectProperty,
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const { userLocation, setManualLocation } = useLocation();

  // Location search mode: 'gps' (automatic discovery) or 'manual' (user chosen)
  const [locationMode, setLocationMode] = useState<'gps' | 'manual'>(() => {
    return initialLocality ? 'manual' : 'gps';
  });

  // Current target location state
  const [currentCity, setCurrentCity] = useState<string>(() => {
    return userLocation.city || 'Prayagraj';
  });
  const [currentLocality, setCurrentLocality] = useState<string>(() => {
    return initialLocality || userLocation.locality || 'Civil Lines';
  });
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (userLocation.latitude && userLocation.longitude) {
      return { lat: userLocation.latitude, lng: userLocation.longitude };
    }
    return null;
  });

  // GPS Telemetry & Status
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(userLocation.accuracy || null);
  const [isLowAccuracy, setIsLowAccuracy] = useState<boolean>(Boolean(userLocation.isLowAccuracy));
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Proximity Search Radius (Default 5 km, expandable to 10 km -> 15 km)
  const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_SEARCH_RADIUS_KM);

  // Modal State
  const [isChangeLocationOpen, setIsChangeLocationOpen] = useState(false);

  // Layout & Filter states
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('list');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [filters, setFilters] = useState<PropertySearchParams>({
    property_type: (initialPropertyType as any) || 'all',
    gender: 'any',
    room_type: 'all',
    max_price: 15000,
    sort_by: 'nearest',
    amenities: [],
    verified_only: false,
  });

  const [searchResult, setSearchResult] = useState<SearchResultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Ref to track if GPS has already run on initial mount
  const hasTriggeredInitialGpsRef = useRef(false);

  /**
   * Request fresh GPS coordinates and perform reverse geocoding.
   * Uses high accuracy, timeout: 20000, maximumAge: 0.
   */
  const triggerGpsDiscovery = useCallback(async () => {
    setIsDetectingLocation(true);
    setGpsError(null);
    setLocationMode('gps');
    setSearchRadius(DEFAULT_SEARCH_RADIUS_KM);

    try {
      const detected = await locationService.detectLocation();
      setCurrentCity(detected.city);
      setCurrentLocality(detected.locality);
      setCurrentCoords({ lat: detected.latitude, lng: detected.longitude });
      setGpsAccuracy(detected.accuracy);
      setIsLowAccuracy(detected.isLowAccuracy);
      setLocationMode('gps');

      // Update location context
      setManualLocation(
        detected.locality,
        detected.latitude,
        detected.longitude,
        detected.city,
        detected.state,
        'gps',
        detected.district
      );
    } catch (err: any) {
      console.warn('GPS detection failed, falling back to default location:', err);
      setGpsError(err.message || "We couldn't detect your location.");

      // Gracefully fall back to Prayagraj / Civil Lines if no coordinates exist
      setCurrentCity((prev) => prev || 'Prayagraj');
      setCurrentLocality((prev) => prev || 'Civil Lines');
      setCurrentCoords((prev) => prev || { lat: 25.4563, lng: 81.8546 });
      setLocationMode('manual');
    } finally {
      setIsDetectingLocation(false);
    }
  }, [setManualLocation]);

  /**
   * Initial Mount Flow:
   * - If an explicit initialLocality was passed in, respect it (manual mode).
   * - Otherwise, AUTOMATIC GPS DISCOVERY on Search Page open!
   */
  useEffect(() => {
    if (initialLocality) {
      setLocationMode('manual');
      setCurrentLocality(initialLocality);
      const found = locationRepository.getLocalityBySlugOrName(initialLocality);
      if (found) {
        setCurrentCity(found.city_name);
        setCurrentCoords({ lat: found.latitude, lng: found.longitude });
      }
      setIsDetectingLocation(false);
      return;
    }

    if (!hasTriggeredInitialGpsRef.current) {
      hasTriggeredInitialGpsRef.current = true;
      triggerGpsDiscovery();
    }
  }, [initialLocality, triggerGpsDiscovery]);

  /**
   * Perform room search whenever target location, radius, or filters change.
   */
  const executeSearch = useCallback(async () => {
    setLoading(true);
    setSearchError(null);

    try {
      const searchParams: PropertySearchParams = {
        ...filters,
        city: currentCity,
        locality: currentLocality,
        reference_lat: currentCoords?.lat,
        reference_lng: currentCoords?.lng,
        radius_km: searchRadius,
        location_source: locationMode === 'gps' ? 'gps' : 'manual',
        sort_by: filters.sort_by || 'nearest',
      };

      const summary = await propertyRepository.searchProperties(
        searchParams,
        currentUser?.id
      );

      setSearchResult(summary);
    } catch (e: any) {
      console.error('Search query failed:', e);
      setSearchError(e.message || 'We could not load rooms right now. Please try again.');
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }, [filters, currentCity, currentLocality, currentCoords, searchRadius, locationMode, currentUser]);

  useEffect(() => {
    // Only execute if not actively waiting on initial GPS detection
    if (!isDetectingLocation) {
      executeSearch();
    }
  }, [executeSearch, isDetectingLocation]);

  /**
   * Handle user manual location change from ChangeLocationModal.
   * Strict Rule: Manual search overrides GPS and is never auto-overwritten by GPS.
   */
  const handleApplyManualLocation = (selected: {
    city: string;
    locality: string;
    lat?: number;
    lng?: number;
  }) => {
    setLocationMode('manual');
    setCurrentCity(selected.city);
    setCurrentLocality(selected.locality);
    if (selected.lat && selected.lng) {
      setCurrentCoords({ lat: selected.lat, lng: selected.lng });
    }
    setGpsError(null);
    setSearchRadius(DEFAULT_SEARCH_RADIUS_KM);

    // Update location context as manual
    setManualLocation(
      selected.locality,
      selected.lat,
      selected.lng,
      selected.city,
      undefined,
      'manual'
    );
  };

  /**
   * Handle Radius Expansion when zero rooms are found in 5 km.
   */
  const handleExpandRadius = () => {
    setSearchRadius((prev) => {
      if (prev <= 5) return 10;
      if (prev <= 10) return 15;
      return 25;
    });
  };

  const handleResetFilters = () => {
    setFilters({
      property_type: 'all',
      gender: 'any',
      room_type: 'all',
      max_price: 15000,
      sort_by: 'nearest',
      amenities: [],
      verified_only: false,
    });
    setSearchRadius(DEFAULT_SEARCH_RADIUS_KM);
  };

  const bucketKeys: ProximityBucket[] = ['very_near', 'nearby', 'nearby_areas', 'more_options'];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
      {/* ========================================================================= */}
      {/* 1. TOP LOCATION & NAVIGATION BAR                                          */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 p-3 sm:p-5 mb-4 sm:mb-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Location Banner & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
              isDetectingLocation
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse'
                : locationMode === 'gps'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {isDetectingLocation ? (
              <Navigation className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : locationMode === 'gps' ? (
              <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {isDetectingLocation ? (
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-heading font-bold text-sm sm:text-base text-slate-900 truncate">
                    Finding rooms near you...
                  </span>
                  <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                    GPS
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  Requesting precise GPS coordinates...
                </p>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="font-heading font-bold text-sm sm:text-lg text-slate-900 leading-snug">
                    Rooms near{' '}
                    <span className="text-amber-700 underline decoration-amber-400 decoration-2 underline-offset-2">
                      {currentLocality}
                    </span>
                    {currentCity && currentCity !== currentLocality ? `, ${currentCity}` : ''}
                  </h1>

                  {locationMode === 'gps' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      GPS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Area
                    </span>
                  )}

                  {searchRadius > 5 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {searchRadius} km
                    </span>
                  )}
                </div>

                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <span className="truncate">
                    {searchResult
                      ? `${searchResult.total_found} room${searchResult.total_found === 1 ? '' : 's'} available`
                      : 'Searching nearby properties...'}
                  </span>
                  <span>•</span>
                  <span className="shrink-0">Nearest first</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions ([ Change Location ], [ Use My Location ], View Modes) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 self-stretch md:self-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            {/* Change Location Action */}
            <button
              type="button"
              onClick={() => setIsChangeLocationOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 transition-all cursor-pointer border border-slate-200"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Change Location</span>
            </button>

            {/* Restore GPS Discovery button (visible when in manual mode or if GPS errored) */}
            {locationMode === 'manual' && (
              <button
                type="button"
                onClick={triggerGpsDiscovery}
                disabled={isDetectingLocation}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-900 border border-amber-300 transition-all cursor-pointer disabled:opacity-60"
              >
                <Navigation className="w-3.5 h-3.5 text-amber-600" />
                <span>📍 My Location</span>
              </button>
            )}
          </div>

          {/* Mobile Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className="lg:hidden flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-800 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Filters</span>
            {filters.amenities && filters.amenities.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">
                {filters.amenities.length}
              </span>
            )}
          </button>

          {/* Desktop View Switcher (List / Split / Map) */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'map'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ADVISORY / FALLBACK BANNERS                                            */}
      {/* ========================================================================= */}

      {/* GPS Error / Denial Fallback Banner */}
      {gpsError && !isDetectingLocation && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs leading-relaxed animate-in fade-in-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold text-sm block">We couldn't detect your exact location</span>
              <p className="mt-0.5 text-amber-800">
                {gpsError} Showing default rooms in {currentLocality}, {currentCity}. You can choose your location manually or try again.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsChangeLocationOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Choose Location Manually
            </button>
            <button
              type="button"
              onClick={triggerGpsDiscovery}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 font-semibold border border-amber-300 transition-colors cursor-pointer"
            >
              Retry GPS
            </button>
          </div>
        </div>
      )}

      {/* Low Accuracy Warning (accuracy > 300m) */}
      {isLowAccuracy && !gpsError && locationMode === 'gps' && (
        <div className="mb-6 p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-center justify-between gap-3 text-xs animate-in fade-in-50">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Low GPS accuracy (~{Math.round(gpsAccuracy || 0)}m). If the detected neighborhood isn't exact, you can tap{' '}
              <strong>Change Location</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsChangeLocationOpen(true)}
            className="text-blue-700 font-bold hover:underline shrink-0 cursor-pointer"
          >
            Refine Area →
          </button>
        </div>
      )}

      {/* Low-Inventory Auto-Expansion Banner */}
      {searchResult?.is_expanded && searchResult.expanded_message && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-amber-900 flex items-start gap-3 text-xs leading-relaxed animate-in fade-in-50">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-bold">Proximity Search Auto-Expansion</span>
            <p className="mt-0.5">{searchResult.expanded_message}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT LAYOUT                                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Desktop Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            totalResults={searchResult?.total_found || 0}
          />
        </div>

        {/* Right Listings / Map Area */}
        <div
          className={`${
            viewMode === 'split'
              ? 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6'
              : 'lg:col-span-3'
          }`}
        >
          {/* MAP CONTAINER (If Split or Full Map mode) */}
          {(viewMode === 'split' || viewMode === 'map') && (
            <div
              className={`${
                viewMode === 'split' ? 'sticky top-24 h-[600px]' : 'h-[650px] mb-6'
              }`}
            >
              <PropertyMap
                properties={searchResult?.properties || []}
                centerCoordinates={searchResult?.reference_coordinates}
                onSelectProperty={onSelectProperty}
                className="h-full w-full rounded-2xl"
              />
            </div>
          )}

          {/* LISTINGS CONTAINER */}
          {viewMode !== 'map' && (
            <div className="space-y-8">
              {/* Subtle Loading Skeletons */}
              {isDetectingLocation || loading ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs text-slate-500 animate-pulse">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-amber-600 animate-spin" />
                      <span className="font-semibold text-slate-800">
                        {isDetectingLocation ? 'Detecting your location...' : 'Searching rooms nearby...'}
                      </span>
                    </div>
                    <span>Checking rooms within {searchRadius} km</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-5 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div
                        key={n}
                        className="h-56 sm:h-72 bg-slate-100 rounded-xl sm:rounded-3xl border border-slate-200/60"
                      />
                    ))}
                  </div>
                </div>
              ) : searchError ? (
                /* Search Error State */
                <div className="bg-red-50/80 border border-red-200 rounded-3xl p-8 text-center max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-red-900 font-heading mb-1">
                    We couldn't load rooms right now
                  </h4>
                  <p className="text-xs text-red-700 max-w-sm mx-auto mb-5 leading-relaxed">
                    {searchError}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={executeSearch}
                      icon={<RotateCw className="w-4 h-4" />}
                    >
                      Retry Search
                    </Button>
                  </div>
                </div>
              ) : searchResult && searchResult.properties.length > 0 ? (
                /* Group by Proximity Presentation Buckets (Nearest -> Farthest) */
                bucketKeys.map((bucketKey) => {
                  const bucketProperties = searchResult.buckets[bucketKey];
                  if (!bucketProperties || bucketProperties.length === 0) return null;
                  const bucketMeta = PROXIMITY_BUCKET_LABELS[bucketKey];

                  return (
                    <div
                      key={bucketKey}
                      className="space-y-3 sm:space-y-4 bg-slate-950 md:bg-transparent rounded-2xl md:rounded-none p-2.5 sm:p-0 border border-slate-800 md:border-transparent"
                    >
                      {/* Mobile Header (< md): Neat, small heading */}
                      <div className="md:hidden flex items-center justify-between px-1.5 pt-1 pb-0.5">
                        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="truncate">{bucketMeta.title}</span>
                          <span className="text-[11px] text-slate-400 font-normal shrink-0">
                            • {bucketProperties.length} room{bucketProperties.length === 1 ? '' : 's'}
                          </span>
                        </h3>
                        <span className="text-[10px] text-amber-400/90 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                          {bucketMeta.subtitle}
                        </span>
                      </div>

                      {/* Desktop Header (>= md): Original Untouched Header */}
                      <div className="hidden md:flex items-center justify-between pb-2 border-b border-slate-200">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 font-heading flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            {bucketMeta.title}
                          </h3>
                          <p className="text-xs text-slate-500">{bucketMeta.subtitle}</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {bucketProperties.length} room{bucketProperties.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Mobile: Compact 2-column Grid (< md) */}
                      <div className="grid grid-cols-2 gap-2.5 px-0.5 py-1 md:hidden">
                        {bucketProperties.map((property) => (
                          <CompactPropertyCard
                            key={property.id}
                            property={property}
                            onSelect={onSelectProperty}
                            singleAction={true}
                          />
                        ))}
                      </div>

                      {/* Desktop: Original Grid Layout (>= md) */}
                      <div
                        className={`hidden md:grid gap-5 ${
                          viewMode === 'split'
                            ? 'grid-cols-1'
                            : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                        }`}
                      >
                        {bucketProperties.map((property) => (
                          <PropertyCard
                            key={property.id}
                            property={property}
                            onSelect={onSelectProperty}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Empty state with Radius Expansion action */
                <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-lg mx-auto shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/60">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 font-heading mb-1.5">
                    No matching rooms found
                  </h4>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto mb-6 leading-relaxed">
                    There are currently no active listings matching your search filters in{' '}
                    <strong>{currentLocality}, {currentCity}</strong>. Try resetting filters or choosing another city/area.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    {searchRadius < 25 && (
                      <button
                        type="button"
                        onClick={handleExpandRadius}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Expand Search to {searchRadius <= 5 ? '10 km' : searchRadius <= 10 ? '15 km' : '25 km'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsChangeLocationOpen(true)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-200 transition-all cursor-pointer"
                    >
                      Change Area
                    </button>

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-200 transition-all cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>

                  {onNavigate && (
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2">Are you a property owner in this area?</p>
                      <button
                        type="button"
                        onClick={() => onNavigate('add-property')}
                        className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>List your room or hostel here</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS & BOTTOM SHEETS                                                 */}
      {/* ========================================================================= */}

      {/* Change Location Modal (Select City + Predefined Area or Custom Input + Search Here) */}
      <ChangeLocationModal
        isOpen={isChangeLocationOpen}
        onClose={() => setIsChangeLocationOpen(false)}
        currentCity={currentCity}
        currentLocality={currentLocality}
        onApplyLocation={handleApplyManualLocation}
      />

      {/* Mobile Filters Bottom Sheet */}
      <BottomSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Student Accommodations"
      >
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
          totalResults={searchResult?.total_found || 0}
        />
        <div className="pt-4 mt-4 border-t border-slate-100">
          <Button
            variant="primary"
            fullWidth
            onClick={() => setIsFilterSheetOpen(false)}
          >
            Show {searchResult?.total_found || 0} Properties
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
};

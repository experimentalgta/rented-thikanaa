import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Map,
  List,
  MapPin,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  Navigation
} from 'lucide-react';
import { LocationSelector } from '../components/search/LocationSelector';
import { FilterSidebar } from '../components/search/FilterSidebar';
import { PropertyCard } from '../components/property/PropertyCard';
import { PropertyMap } from '../components/map/PropertyMap';
import { BottomSheet } from '../components/common/BottomSheet';
import { Button } from '../components/common/Button';
import {
  Property,
  PropertySearchParams,
  SearchResultSummary,
  ProximityBucket
} from '../types';
import { propertyRepository } from '../services/propertyRepository';
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
  const { userLocation, clearLocation } = useLocation();
  const [selectedLocality, setSelectedLocality] = useState(() => {
    if (userLocation.source === 'gps' && userLocation.locality) {
      return userLocation.locality;
    }
    return initialLocality;
  });
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('list');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [filters, setFilters] = useState<PropertySearchParams>(() => ({
    locality: userLocation.source === 'gps' && userLocation.locality ? userLocation.locality : initialLocality,
    reference_lat: userLocation.source === 'gps' ? userLocation.latitude : undefined,
    reference_lng: userLocation.source === 'gps' ? userLocation.longitude : undefined,
    location_source: userLocation.source,
    property_type: (initialPropertyType as any) || 'all',
    gender: 'any',
    room_type: 'all',
    max_price: 15000,
    sort_by: 'nearest',
    amenities: [],
    verified_only: false,
  }));

  // Sync when userLocation updates (e.g. GPS detected or cleared)
  useEffect(() => {
    if (userLocation.source === 'gps' && userLocation.latitude && userLocation.longitude) {
      setFilters((prev) => ({
        ...prev,
        locality: userLocation.locality || prev.locality,
        reference_lat: userLocation.latitude,
        reference_lng: userLocation.longitude,
        location_source: 'gps',
      }));
      if (userLocation.locality) {
        setSelectedLocality(userLocation.locality);
      }
    } else if (userLocation.source === 'none') {
      setFilters((prev) => ({
        ...prev,
        reference_lat: undefined,
        reference_lng: undefined,
        location_source: 'none',
      }));
    }
  }, [userLocation.source, userLocation.latitude, userLocation.longitude, userLocation.locality]);

  const [searchResult, setSearchResult] = useState<SearchResultSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Perform search whenever filters or target locality changes
  const executeSearch = async () => {
    setLoading(true);
    try {
      const summary = await propertyRepository.searchProperties(
        { ...filters, locality: selectedLocality },
        currentUser.id
      );
      setSearchResult(summary);
    } catch (e) {
      console.error('Search query failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch();
  }, [filters, selectedLocality, currentUser.id]);

  const handleResetFilters = () => {
    setFilters({
      locality: selectedLocality,
      property_type: 'all',
      gender: 'any',
      room_type: 'all',
      max_price: 15000,
      sort_by: 'nearest',
      amenities: [],
      verified_only: false,
    });
  };

  const bucketKeys: ProximityBucket[] = ['very_near', 'nearby', 'nearby_areas', 'more_options'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Top Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 sm:p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <LocationSelector
            selectedLocality={selectedLocality}
            onSelect={(loc, lat, lng, cityName) => {
              setSelectedLocality(loc);
              setFilters((prev) => ({
                ...prev,
                locality: loc,
                city: cityName,
                reference_lat: lat,
                reference_lng: lng,
              }));
            }}
            size="md"
          />
        </div>

        {/* View Mode & Filter Triggers */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          {/* Mobile Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F8FAFC] border border-[#E2E8F0] text-[#101828]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Filters</span>
            {filters.amenities && filters.amenities.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#101828] text-white text-[10px] flex items-center justify-center">
                {filters.amenities.length}
              </span>
            )}
          </button>

          {/* Desktop View Switcher */}
          <div className="flex items-center bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] text-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-[#101828] font-bold shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <List className="w-4 h-4" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'split'
                  ? 'bg-white text-[#101828] font-bold shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Split Map</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'map'
                  ? 'bg-white text-[#101828] font-bold shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* GPS Active Proximity Notice */}
      {userLocation.source === 'gps' && (
        <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-[#101828] text-white border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/30">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Showing the closest options to your location</span>
                <span className="text-[10px] font-semibold text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/20">
                  GPS Active
                </span>
              </div>
              <p className="text-[#94A3B8] text-xs mt-0.5">
                {userLocation.displayName || `Near ${selectedLocality}, Prayagraj`} • Ranked by true walking distance without hard cutoffs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearLocation();
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            Clear GPS
          </button>
        </div>
      )}

      {/* Low-Inventory Auto-Expansion Banner */}
      {searchResult?.is_expanded && searchResult.expanded_message && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] flex items-start gap-3 text-xs leading-relaxed animate-in fade-in-50">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
          <div>
            <span className="font-bold">Proximity Search Auto-Expansion</span>
            <p className="mt-0.5">{searchResult.expanded_message}</p>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
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
        <div className={`${viewMode === 'split' ? 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6' : 'lg:col-span-3'}`}>
          {/* MAP CONTAINER (If Split or Full Map mode) */}
          {(viewMode === 'split' || viewMode === 'map') && (
            <div className={`${viewMode === 'split' ? 'sticky top-24 h-[600px]' : 'h-[650px] mb-6'}`}>
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
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-pulse">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-64 bg-slate-200 rounded-2xl" />
                  ))}
                </div>
              ) : searchResult && searchResult.properties.length > 0 ? (
                // Group by continuous proximity presentation buckets
                bucketKeys.map((bucketKey) => {
                  const bucketProperties = searchResult.buckets[bucketKey];
                  if (!bucketProperties || bucketProperties.length === 0) return null;
                  const bucketMeta = PROXIMITY_BUCKET_LABELS[bucketKey];

                  return (
                    <div key={bucketKey} className="space-y-4">
                      {/* Bucket Section Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                        <div>
                          <h3 className="font-bold text-base text-[#101828] font-heading flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                            {bucketMeta.title}
                          </h3>
                          <p className="text-xs text-[#667085]">{bucketMeta.subtitle}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155]">
                          {bucketProperties.length} options
                        </span>
                      </div>

                      {/* Cards Grid */}
                      <div
                        className={`grid gap-5 ${
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
                /* Empty state with listing prompt */
                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-full bg-[#FFFBEB] text-[#D97706] flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-[#111827] font-heading mb-1">
                    No rooms listed in {selectedLocality || 'this location'} yet
                  </h4>
                  <p className="text-xs text-[#667085] max-w-sm mx-auto mb-5">
                    {searchResult?.expanded_message ||
                      'Be the first member to list a room, PG, flat, or hostel here. You can also reset filters to explore more areas.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="primary" size="sm" onClick={handleResetFilters}>
                      Reset Search Filters
                    </Button>
                    {onNavigate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate('add-property')}
                      >
                        + List a Property Here
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
        <div className="pt-4 mt-4 border-t border-[#F1F5F9]">
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

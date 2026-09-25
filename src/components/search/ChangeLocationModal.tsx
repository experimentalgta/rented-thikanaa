import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  X,
  Search,
  Check,
  Building2,
  Edit3,
  ListFilter
} from 'lucide-react';
import { getSupportedCities, getCityConfig, getCityAreas, CityConfig } from '../../data/cityAreas';
import { locationRepository } from '../../services/locationRepository';

interface ChangeLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCity?: string;
  currentLocality?: string;
  onApplyLocation: (selected: {
    city: string;
    locality: string;
    lat?: number;
    lng?: number;
  }) => void;
}

export const ChangeLocationModal: React.FC<ChangeLocationModalProps> = ({
  isOpen,
  onClose,
  currentCity = 'Prayagraj',
  currentLocality = 'Civil Lines',
  onApplyLocation,
}) => {
  const cities: CityConfig[] = useMemo(() => getSupportedCities(), []);

  const [selectedCity, setSelectedCity] = useState(currentCity);
  const [selectedArea, setSelectedArea] = useState(currentLocality);
  const [areaMode, setAreaMode] = useState<'predefined' | 'custom'>('predefined');
  const [customAreaText, setCustomAreaText] = useState('');
  const [areaSearchFilter, setAreaSearchFilter] = useState('');

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedCity(currentCity || 'Prayagraj');
      setSelectedArea(currentLocality || 'Civil Lines');
      setCustomAreaText(currentLocality || '');
      setAreaSearchFilter('');
    }
  }, [isOpen, currentCity, currentLocality]);

  // Predefined areas for the currently selected city
  const cityAreas = useMemo(() => {
    return getCityAreas(selectedCity);
  }, [selectedCity]);

  // Filtered areas based on search query
  const filteredAreas = useMemo(() => {
    if (!areaSearchFilter.trim()) return cityAreas;
    const q = areaSearchFilter.toLowerCase().trim();
    return cityAreas.filter((a) => a.toLowerCase().includes(q));
  }, [cityAreas, areaSearchFilter]);

  if (!isOpen) return null;

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    const newAreas = getCityAreas(cityName);
    const defaultFirst = newAreas[0] || cityName;
    setSelectedArea(defaultFirst);
    setCustomAreaText(defaultFirst);
  };

  const handleApply = () => {
    const finalArea =
      areaMode === 'custom'
        ? customAreaText.trim() || selectedArea || 'Civil Lines'
        : selectedArea || 'Civil Lines';

    // Try resolving coordinates for the locality
    const foundLoc = locationRepository.getLocalityBySlugOrName(finalArea, selectedCity);
    let lat: number | undefined = foundLoc?.latitude;
    let lng: number | undefined = foundLoc?.longitude;

    if (!lat || !lng) {
      const cityCfg = getCityConfig(selectedCity);
      lat = cityCfg?.defaultLat || 25.4358;
      lng = cityCfg?.defaultLon || 81.8463;
    }

    onApplyLocation({
      city: selectedCity,
      locality: finalArea,
      lat,
      lng,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-900 leading-tight">
                Change Location
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select your preferred city and neighborhood
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Step 1: Select City */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              1. Select City
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cities.map((c) => {
                const isSelected = selectedCity.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCityChange(c.name)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className="truncate">{c.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-auto text-amber-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose Area Selection Mode */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                2. Select Area / Locality
              </label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setAreaMode('predefined')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    areaMode === 'predefined'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ListFilter className="w-3 h-3" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAreaMode('custom')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    areaMode === 'custom'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Type</span>
                </button>
              </div>
            </div>

            {areaMode === 'predefined' ? (
              <div className="space-y-2">
                {/* Search filter for areas */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={areaSearchFilter}
                    onChange={(e) => setAreaSearchFilter(e.target.value)}
                    placeholder={`Search areas in ${selectedCity}...`}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  />
                  {areaSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setAreaSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Predefined list grid */}
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50/50 space-y-1">
                  {filteredAreas.length > 0 ? (
                    filteredAreas.map((area) => {
                      const isChosen = selectedArea.toLowerCase() === area.toLowerCase();
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => setSelectedArea(area)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                            isChosen
                              ? 'bg-amber-500 text-white font-semibold shadow-xs'
                              : 'hover:bg-white text-slate-700'
                          }`}
                        >
                          <span>{area}</span>
                          {isChosen && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No matching areas in {selectedCity}. You can switch to "Type" mode to enter it manually.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customAreaText}
                  onChange={(e) => setCustomAreaText(e.target.value)}
                  placeholder={`e.g. Civil Lines, Katra, Gomti Nagar...`}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500">
                  Type any locality, street, or colony in {selectedCity}.
                </p>
              </div>
            )}
          </div>

          {/* Location Summary */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                  Target Search Location
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {areaMode === 'custom'
                    ? customAreaText.trim() || selectedArea || 'Select Area'
                    : selectedArea || 'Select Area'}
                  , {selectedCity}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={areaMode === 'custom' && !customAreaText.trim() && !selectedArea}
            className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-98 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
          >
            <span>Search Here</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Filter, SlidersHorizontal, RotateCcw, ShieldCheck, Check } from 'lucide-react';
import { PropertySearchParams, PropertyType, GenderPreference, RoomType } from '../../types';
import { AMENITIES_CATALOG } from '../../config/brand';

interface FilterSidebarProps {
  filters: PropertySearchParams;
  onChange: (updated: PropertySearchParams) => void;
  onReset: () => void;
  totalResults: number;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onChange,
  onReset,
  totalResults,
}) => {
  const propertyTypes: { id: PropertyType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Types' },
    { id: 'pg', label: 'PG' },
    { id: 'hostel', label: 'Hostel' },
    { id: 'room', label: 'Room' },
    { id: 'flat', label: 'Flat' },
    { id: 'shared_room', label: 'Shared' },
  ];

  const genderOptions: { id: GenderPreference; label: string }[] = [
    { id: 'any', label: 'Any Gender' },
    { id: 'male', label: 'Boys Only' },
    { id: 'female', label: 'Girls Only' },
  ];

  const roomTypes: { id: RoomType | 'all'; label: string }[] = [
    { id: 'all', label: 'Any Occupancy' },
    { id: 'single', label: 'Single' },
    { id: 'double', label: 'Double' },
    { id: 'triple', label: 'Triple' },
  ];

  const handleAmenityToggle = (amenityId: string) => {
    const current = filters.amenities || [];
    const next = current.includes(amenityId)
      ? current.filter((id) => id !== amenityId)
      : [...current, amenityId];
    onChange({ ...filters, amenities: next });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#101828]" />
          <h3 className="font-bold text-sm text-[#101828] font-heading">Search Filters</h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-[#667085] hover:text-[#101828] flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Sort By */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
          Sort By
        </label>
        <select
          value={filters.sort_by || 'nearest'}
          onChange={(e) => onChange({ ...filters, sort_by: e.target.value as any })}
          className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
        >
          <option value="nearest">Nearest First (Recommended)</option>
          <option value="price_low">Lowest Price First</option>
          <option value="price_high">Highest Price First</option>
          <option value="newest">Newest Listed</option>
        </select>
      </div>

      {/* Maximum Budget */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#667085]">
            Max Monthly Rent
          </label>
          <span className="text-xs font-bold text-[#101828] font-heading">
            ₹{filters.max_price ? filters.max_price.toLocaleString('en-IN') : '12,000+'}
          </span>
        </div>
        <input
          type="range"
          min={2500}
          max={15000}
          step={500}
          value={filters.max_price || 15000}
          onChange={(e) => onChange({ ...filters, max_price: Number(e.target.value) })}
          className="w-full accent-[#F59E0B] cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-[#94A3B8] mt-1">
          <span>₹2.5k</span>
          <span>₹7.5k</span>
          <span>₹15k</span>
        </div>
      </div>

      {/* Property Type */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
          Property Type
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {propertyTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ ...filters, property_type: t.id })}
              className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                (filters.property_type || 'all') === t.id
                  ? 'bg-[#101828] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gender Suitability */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
          Gender Suitability
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {genderOptions.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange({ ...filters, gender: g.id })}
              className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                (filters.gender || 'any') === g.id
                  ? 'bg-[#F59E0B] text-[#101828] font-bold shadow-xs'
                  : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Room Occupancy */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
          Room Occupancy
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {roomTypes.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange({ ...filters, room_type: r.id })}
              className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                (filters.room_type || 'all') === r.id
                  ? 'bg-[#172554] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Verified Only Toggle */}
      <div className="pt-2 border-t border-[#F1F5F9]">
        <label className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs font-semibold text-[#111827]">
              Verified Properties Only
            </span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(filters.verified_only)}
            onChange={(e) => onChange({ ...filters, verified_only: e.target.checked })}
            className="w-4 h-4 rounded text-[#F59E0B] focus:ring-[#F59E0B] border-[#CBD5E1]"
          />
        </label>
      </div>

      {/* Must-Have Amenities */}
      <div className="pt-2 border-t border-[#F1F5F9]">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
          Must-Have Amenities
        </label>
        <div className="space-y-2">
          {AMENITIES_CATALOG.slice(0, 6).map((amenity) => {
            const isChecked = (filters.amenities || []).includes(amenity.id);
            return (
              <label
                key={amenity.id}
                className="flex items-center justify-between text-xs text-[#334155] cursor-pointer hover:text-[#111827]"
              >
                <span>{amenity.name}</span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleAmenityToggle(amenity.id)}
                  className="w-4 h-4 rounded text-[#F59E0B] focus:ring-[#F59E0B] border-[#CBD5E1]"
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

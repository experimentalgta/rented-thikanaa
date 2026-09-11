import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Search, GraduationCap, X, ChevronDown } from 'lucide-react';
import { PRAYAGRAJ_LOCALITIES, PRAYAGRAJ_COLLEGES } from '../../config/localities';

interface LocationSelectorProps {
  selectedLocality: string;
  onSelect: (localityName: string, lat?: number, lng?: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocality,
  onSelect,
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(selectedLocality || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedLocality);
  }, [selectedLocality]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLocalities = PRAYAGRAJ_LOCALITIES.filter((loc) =>
    loc.name.toLowerCase().includes(query.toLowerCase()) ||
    loc.hindi_name.includes(query) ||
    loc.popular_for.toLowerCase().includes(query.toLowerCase())
  );

  const filteredColleges = PRAYAGRAJ_COLLEGES.filter((col) =>
    col.name.toLowerCase().includes(query.toLowerCase()) ||
    col.short_name.toLowerCase().includes(query.toLowerCase()) ||
    col.locality.toLowerCase().includes(query.toLowerCase())
  );

  const sizeStyles = {
    sm: 'h-10 text-xs px-3',
    md: 'h-12 text-sm px-4',
    lg: 'h-14 sm:h-16 text-base px-4 sm:px-5',
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Search Input Box */}
      <div
        className={`flex items-center gap-3 bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] focus-within:border-[#F59E0B] focus-within:ring-2 focus-within:ring-[#F59E0B]/20 rounded-2xl shadow-xs transition-all cursor-pointer ${sizeStyles[size]}`}
        onClick={() => setIsOpen(true)}
      >
        <MapPin className="w-5 h-5 text-[#F59E0B] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search Katra, Civil Lines, University or College..."
          className="w-full bg-transparent border-none text-[#111827] placeholder:text-[#94A3B8] focus:outline-none font-medium truncate"
        />
        {query ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              setIsOpen(true);
            }}
            className="p-1 text-[#94A3B8] hover:text-[#111827] rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] max-h-96 overflow-y-auto z-50 p-2 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Quick Popular Localities */}
          <div className="p-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#667085] px-2.5 pb-2">
              Popular Student Areas in Prayagraj
            </div>
            <div className="space-y-1">
              {filteredLocalities.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    onSelect(loc.name, loc.latitude, loc.longitude);
                    setQuery(loc.name);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F8FAFC] text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-[#F59E0B]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#111827] group-hover:text-[#101828]">
                          {loc.name}
                        </span>
                        <span className="text-xs text-[#94A3B8]">{loc.hindi_name}</span>
                      </div>
                      <p className="text-xs text-[#667085] line-clamp-1">{loc.popular_for}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-[#64748B] shrink-0 bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                    {loc.active_listings_count} rooms
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Colleges / Coaching Hubs */}
          {filteredColleges.length > 0 && (
            <div className="p-2 border-t border-[#F1F5F9]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#667085] px-2.5 py-2 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#F59E0B]" />
                Rooms Near Colleges &amp; Coaching Hubs
              </div>
              <div className="space-y-1">
                {filteredColleges.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      onSelect(col.short_name, col.latitude, col.longitude);
                      setQuery(col.short_name);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F8FAFC] text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4 text-[#101828]" />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-[#111827] group-hover:text-[#101828]">
                          {col.name}
                        </div>
                        <p className="text-xs text-[#667085]">
                          Located in {col.locality}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-[#F59E0B] shrink-0">
                      Search Proximity
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

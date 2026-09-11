import React from 'react';
import {
  Heart,
  ShieldCheck,
  MapPin,
  Wifi,
  Utensils,
  Flame,
  Wind,
  Bath,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Property } from '../../types';
import { useSaved } from '../../context/SavedContext';
import { DistanceBadge } from './DistanceBadge';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  layout?: 'grid' | 'horizontal';
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onSelect,
  layout = 'grid',
}) => {
  const { isSaved, toggleSave } = useSaved();
  const saved = isSaved(property.id);

  const coverImage =
    property.images.find((img) => img.is_cover)?.url ||
    property.images[0]?.url ||
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80';

  const typeLabels: Record<string, string> = {
    room: 'Room',
    pg: 'Student PG',
    hostel: 'Hostel',
    flat: 'Flat / Apt',
    shared_room: 'Shared Room',
    homestay: 'Homestay',
  };

  const genderLabels: Record<string, string> = {
    male: 'Boys',
    female: 'Girls',
    any: 'Co-ed / Any',
  };

  return (
    <div
      onClick={() => onSelect(property)}
      className={`group relative bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col ${
        layout === 'horizontal' ? 'sm:flex-row' : ''
      }`}
    >
      {/* Property Image Container */}
      <div
        className={`relative overflow-hidden bg-[#F1F5F9] shrink-0 ${
          layout === 'horizontal' ? 'sm:w-64 h-52 sm:h-auto' : 'w-full h-50 sm:h-54'
        }`}
      >
        <img
          src={coverImage}
          alt={property.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Top Floating Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5">
            {property.is_verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/95 text-[#101828] shadow-xs backdrop-blur-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
                Verified
              </span>
            )}
            {property.is_featured && (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#101828] text-[#F59E0B] shadow-xs">
                FEATURED
              </span>
            )}
            {property.is_demo && (
              <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800/80 text-white backdrop-blur-xs">
                Demo
              </span>
            )}
          </div>

          {/* Heart Save Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSave(property);
            }}
            className="pointer-events-auto p-2 rounded-full bg-white/90 hover:bg-white text-[#111827] shadow-xs hover:scale-110 active:scale-95 transition-all"
            title={saved ? 'Remove from saved' : 'Save property'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                saved ? 'fill-[#F97316] text-[#F97316]' : 'text-[#475569]'
              }`}
            />
          </button>
        </div>

        {/* Property Type & Gender Tag on Image Bottom */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#101828]/80 text-white backdrop-blur-xs">
            {typeLabels[property.property_type] || property.property_type}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/90 text-[#101828] backdrop-blur-xs">
            {genderLabels[property.gender_preference]}
          </span>
        </div>
      </div>

      {/* Card Content Section */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
        <div>
          {/* Locality & Distance Row */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-[#667085] flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              {property.locality}, Prayagraj
            </span>
            <DistanceBadge distanceFormatted={property.distance_formatted} />
          </div>

          {/* Title */}
          <h3 className="font-semibold text-[#111827] text-base leading-snug font-heading group-hover:text-[#101828] line-clamp-1 mb-1">
            {property.title}
          </h3>

          {/* Sub-locality or landmark */}
          {property.landmark && (
            <p className="text-xs text-[#94A3B8] line-clamp-1 mb-3">
              {property.landmark}
            </p>
          )}

          {/* Key Amenities preview (2-3 items) */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs text-[#475569]">
            {property.amenities.includes('wifi') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                <Wifi className="w-3 h-3 text-[#64748B]" /> Wi-Fi
              </span>
            )}
            {property.amenities.includes('food_available') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                <Utensils className="w-3 h-3 text-[#64748B]" /> Food Included
              </span>
            )}
            {property.attached_bathroom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                <Bath className="w-3 h-3 text-[#64748B]" /> Attached Bath
              </span>
            )}
          </div>
        </div>

        {/* Bottom Price & Action Row */}
        <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-extrabold text-[#101828] font-heading">
                ₹{property.rent.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-[#667085]">/ month</span>
            </div>
            <div className="text-[10px] text-[#94A3B8]">
              {property.electricity_billing === 'included'
                ? 'Electricity included'
                : 'Electricity per meter'}
            </div>
          </div>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#101828] text-white group-hover:bg-[#F59E0B] group-hover:text-[#101828] transition-all shadow-xs"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

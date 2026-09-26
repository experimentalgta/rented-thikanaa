import React from 'react';
import {
  Heart,
  ShieldCheck,
  MapPin,
  MessageSquare
} from 'lucide-react';
import { Property } from '../../types';
import { useSaved } from '../../context/SavedContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

interface CompactPropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
}

export const CompactPropertyCard: React.FC<CompactPropertyCardProps> = ({
  property,
  onSelect,
}) => {
  const { isSaved, toggleSave } = useSaved();
  const { setIsChatModalOpen } = useChat();
  const { requireAuth } = useAuth();
  const saved = isSaved(property.id);

  const coverImage =
    property.images.find((img) => img.is_cover)?.url ||
    property.images[0]?.url ||
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80';

  const typeLabels: Record<string, string> = {
    room: 'ROOM',
    pg: 'STUDENT PG',
    hostel: 'HOSTEL',
    flat: 'FLAT',
    shared_room: 'SHARED ROOM',
    homestay: 'HOMESTAY',
  };

  const genderLabels: Record<string, string> = {
    male: 'BOYS',
    female: 'GIRLS',
    any: 'CO-ED',
  };

  const typeTag = typeLabels[property.property_type] || property.property_type.toUpperCase();
  const genderTag = genderLabels[property.gender_preference] || 'ALL';

  return (
    <div
      onClick={() => onSelect(property)}
      className="group bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.99]"
    >
      {/* 1. Image Container (Aspect 4:3) */}
      <div className="relative w-full aspect-[4/3] bg-slate-800 overflow-hidden shrink-0">
        <img
          src={coverImage}
          alt={property.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Top-Left Badge (Verified or Gender) */}
        <div className="absolute top-2 left-2 pointer-events-none">
          {property.is_verified ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white font-medium shadow-xs backdrop-blur-xs">
              <ShieldCheck className="w-3 h-3 text-white" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-200 font-medium shadow-xs backdrop-blur-xs">
              {genderTag}
            </span>
          )}
        </div>

        {/* Top-Right Heart Wishlist Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSave(property);
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition active:scale-90 pointer-events-auto"
          title={saved ? 'Remove from saved' : 'Save property'}
          aria-label={saved ? 'Remove from saved' : 'Save property'}
        >
          <Heart
            className={`w-3.5 h-3.5 transition-colors ${
              saved ? 'fill-[#F97316] text-[#F97316]' : 'text-white'
            }`}
          />
        </button>
      </div>

      {/* 2. Content Body (Compact & Minimal) */}
      <div className="p-2.5 flex flex-col flex-1 justify-between">
        <div>
          {/* Category / Gender Tag */}
          <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase truncate">
            {typeTag} • {genderTag}
          </div>

          {/* Title (Line-clamp-1) */}
          <h3 className="text-xs font-semibold text-slate-100 line-clamp-1 leading-tight mt-0.5 group-hover:text-amber-400 transition-colors">
            {property.title}
          </h3>

          {/* Location & Distance */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1 truncate">
            <MapPin className="w-3 h-3 text-[#F59E0B] shrink-0" />
            <span className="truncate">
              {property.locality}
              {property.distance_formatted ? ` • ${property.distance_formatted}` : ''}
            </span>
          </div>

          {/* Pricing */}
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-sm font-bold text-amber-400">
              ₹{property.rent.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-normal text-slate-400">/mo</span>
          </div>
        </div>

        {/* 3. Card Action Buttons (Dual Mini-Buttons: Chat + Details) */}
        <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (
                requireAuth('Sign in with Google to chat with the property owner.', {
                  type: 'chat',
                  propertyId: property.id,
                })
              ) {
                setIsChatModalOpen(true);
              }
            }}
            className="py-1 px-1.5 text-[11px] font-medium rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white text-center transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
          >
            <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(property);
            }}
            className="py-1 px-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-center transition shadow-xs cursor-pointer truncate"
          >
            Details
          </button>
        </div>
      </div>
    </div>
  );
};

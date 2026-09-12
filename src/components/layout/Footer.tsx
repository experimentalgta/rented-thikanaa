import React from 'react';
import { ShieldCheck, MapPin, Phone, Mail, Heart, Building2 } from 'lucide-react';
import { INDIAN_CITIES } from '../../config/locations';

interface FooterProps {
  onSelectLocality: (localityName: string) => void;
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectLocality, onNavigate }) => {
  return (
    <footer className="bg-[#101828] text-white pt-14 pb-20 lg:pb-12 border-t border-[#1E293B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 pb-12 border-b border-[#1E293B]">
          {/* Col 1 & 2: Brand & Proposition */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center">
                <span className="text-base font-black text-[#101828] font-heading">RT</span>
              </div>
              <span className="text-xl font-bold tracking-tight font-heading text-white">
                Rented Thikan
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-4 max-w-sm">
              India's premier, privacy-first living marketplace. Find verified rooms, PGs, hostels, flats, and compatible roommates across India's top education and job hubs.
            </p>
            <div className="p-3.5 rounded-xl bg-[#172554]/60 border border-[#1E293B] max-w-sm">
              <div className="flex items-center gap-2 text-[#F59E0B] text-xs font-semibold mb-1">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Privacy-First Living Architecture
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-normal">
                Phone numbers are private by default. In-app communication first. Exact doorstep coordinates and house numbers remain confidential and are fuzzed on the public map.
              </p>
            </div>
          </div>

          {/* Col 3: Popular Cities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-4">
              Top Indian Cities
            </h4>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              {INDIAN_CITIES.slice(0, 6).map((city) => (
                <li key={city.id}>
                  <button
                    onClick={() => onSelectLocality(city.name)}
                    className="hover:text-white transition-colors text-left"
                  >
                    Rooms in {city.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Platform Features */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-4">
              Explore
            </h4>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                <button
                  onClick={() => onNavigate('search')}
                  className="hover:text-white transition-colors text-left"
                >
                  Browse Rooms &amp; PGs
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('roommates')}
                  className="hover:text-white transition-colors text-left"
                >
                  Find a Roommate
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('add-property')}
                  className="hover:text-white transition-colors text-left"
                >
                  List Your Room (Free)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('member-dashboard')}
                  className="hover:text-white transition-colors text-left"
                >
                  Member Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin-panel')}
                  className="hover:text-white transition-colors text-left text-xs text-[#94A3B8]"
                >
                  Moderation &amp; Trust Panel
                </button>
              </li>
            </ul>
          </div>

          {/* Col 5: Active & Expanding Hubs */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-4">
              Active Hubs
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <span className="font-medium text-white">Prayagraj</span>
                <span className="text-[10px] bg-[#F59E0B] text-[#101828] font-bold px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <span className="font-medium text-white">Lucknow</span>
                <span className="text-[10px] bg-[#F59E0B] text-[#101828] font-bold px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <span className="font-medium text-white">Delhi / NCR</span>
                <span className="text-[10px] bg-[#F59E0B] text-[#101828] font-bold px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <span className="font-medium text-white">Mumbai &amp; Bengaluru</span>
                <span className="text-[10px] bg-[#F59E0B] text-[#101828] font-bold px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <p>© 2026 Rented Thikan. India-Wide Room, Property &amp; Roommate Marketplace.</p>
          <div className="flex items-center gap-4">
            <span className="text-amber-400/80">Find a Room. Find a Roommate. Stay Safe.</span>
            <span>•</span>
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

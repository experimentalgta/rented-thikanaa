import React from 'react';
import { ShieldCheck, MapPin, Phone, Mail, Heart } from 'lucide-react';
import { PRAYAGRAJ_LOCALITIES } from '../../config/localities';

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
                <span className="text-xl font-black text-[#101828] font-heading">P</span>
              </div>
              <span className="text-xl font-bold tracking-tight font-heading text-white">
                PrayagLiving
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-4 max-w-sm">
              The premium, privacy-first student living platform for Prayagraj. Discover verified rooms, PGs, hostels and compatible student roommates near Allahabad University and major coaching hubs.
            </p>
            <div className="p-3.5 rounded-xl bg-[#172554]/60 border border-[#1E293B] max-w-sm">
              <div className="flex items-center gap-2 text-[#F59E0B] text-xs font-semibold mb-1">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Privacy-First Architecture
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-normal">
                Phone numbers are private by default. In-app communication first. Exact property coordinates are kept private and fuzzed on the public map.
              </p>
            </div>
          </div>

          {/* Col 3: Popular Localities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-4">
              Student Localities
            </h4>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              {PRAYAGRAJ_LOCALITIES.slice(0, 6).map((loc) => (
                <li key={loc.id}>
                  <button
                    onClick={() => onSelectLocality(loc.name)}
                    className="hover:text-white transition-colors text-left"
                  >
                    Rooms in {loc.name}
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
                  Browse Student PGs
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
                  onClick={() => onNavigate('owner-add')}
                  className="hover:text-white transition-colors text-left"
                >
                  List Your Property (Free)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('student-dashboard')}
                  className="hover:text-white transition-colors text-left"
                >
                  Student Dashboard
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

          {/* Col 5: Expansion & City Teaser */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-4">
              Launch Cities
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <span className="font-medium text-white">Prayagraj, UP</span>
                <span className="text-[10px] bg-[#F59E0B] text-[#101828] font-bold px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 opacity-60">
                <span>Varanasi</span>
                <span className="text-[10px] text-[#94A3B8]">Coming Next</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 opacity-60">
                <span>Lucknow</span>
                <span className="text-[10px] text-[#94A3B8]">Coming Next</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 opacity-60">
                <span>Delhi (North Campus)</span>
                <span className="text-[10px] text-[#94A3B8]">Coming Next</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <p>© 2026 PrayagLiving. Built for the student community of Prayagraj.</p>
          <div className="flex items-center gap-4">
            <span className="text-amber-400/80">Demo seed data clearly flagged for evaluation</span>
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

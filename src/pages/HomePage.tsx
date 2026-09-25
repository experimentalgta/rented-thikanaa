import React from 'react';
import {
  Search,
  MapPin,
  ShieldCheck,
  Users,
  Lock,
  ArrowRight,
  PlusCircle,
  Sparkles,
  PhoneOff
} from 'lucide-react';
import { LocationSelector } from '../components/search/LocationSelector';
import { LocationPromptBanner } from '../components/search/LocationPromptBanner';
import { useLocation } from '../context/LocationContext';
import { PropertyCard } from '../components/property/PropertyCard';
import { Property, StudentProfile } from '../types';
import { INDIAN_CITIES } from '../config/locations';
import { Button } from '../components/common/Button';

interface HomePageProps {
  featuredProperties: Property[];
  sampleRoommates: StudentProfile[];
  onSearch: (locality: string, propertyType?: string) => void;
  onSelectProperty: (property: Property) => void;
  onNavigate: (view: string, param?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  featuredProperties,
  sampleRoommates,
  onSearch,
  onSelectProperty,
  onNavigate,
}) => {
  const { userLocation } = useLocation();
  const [selectedLocality, setSelectedLocality] = React.useState(userLocation.locality || '');

  React.useEffect(() => {
    if (userLocation.locality) {
      setSelectedLocality(userLocation.locality);
    }
  }, [userLocation.locality]);

  const propertyTypes = [
    { id: 'room', name: 'Rooms', icon: '🏠', count: '48+ active' },
    { id: 'pg', name: 'Student PGs', icon: '🏢', count: '62+ active' },
    { id: 'hostel', name: 'Hostels', icon: '🛏', count: '30+ active' },
    { id: 'flat', name: 'Student Flats', icon: '🏡', count: '24+ active' },
    { id: 'shared_room', name: 'Shared Rooms', icon: '👥', count: '18+ active' },
    { id: 'roommates', name: 'Find Roommates', icon: '🤝', count: '50+ seeking' },
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-28 md:pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#101828] via-[#172554] to-[#101828] text-white pt-12 sm:pt-20 pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8">
        {/* Subtle decorative grid */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-[#F59E0B] mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse shrink-0" />
            <span className="md:hidden">✓ Verified Homes • Zero Brokerage</span>
            <span className="hidden md:inline">India's Privacy-First Housing Network • Find Rooms &amp; Compatible Roommates</span>
          </div>

          {/* Core Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight font-heading leading-tight sm:leading-none text-white mb-6">
            <span className="md:hidden">Find Your Perfect Thikana.</span>
            <span className="hidden md:inline">
              Find Your Perfect Thikan. <br className="hidden sm:inline" />
              <span className="text-[#F59E0B]">Across All of India.</span>
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-sm sm:text-lg text-[#CBD5E1] max-w-2xl mx-auto mb-8 leading-relaxed">
            <span className="md:hidden">Verified rooms, PGs, and flatmates across India.</span>
            <span className="hidden md:inline">
              Discover verified rooms, PGs, hostels, flats, and compatible roommates across Indian cities with transparent rent and zero broker hassle.
            </span>
          </p>

          {/* Geolocation Prompt Banner */}
          <LocationPromptBanner
            className="mb-5 max-w-3xl mx-auto text-left"
            onSuccess={() => {
              if (userLocation.locality) {
                onSearch(userLocation.locality);
              }
            }}
          />

          {/* Main Search Component */}
          <div className="bg-slate-800 md:bg-white rounded-3xl p-3 sm:p-4 shadow-2xl border border-slate-700 md:border-white/20 text-white md:text-[#111827] max-w-3xl mx-auto text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 md:text-[#64748B] mb-2 px-1">
              Where do you want to stay in India?
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1">
                <LocationSelector
                  selectedLocality={selectedLocality}
                  onSelect={(loc) => setSelectedLocality(loc)}
                  size="lg"
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={() => onSearch(selectedLocality)}
                icon={<Search className="w-5 h-5" />}
                className="font-bold sm:w-44 text-base"
              >
                Find My Place
              </Button>
            </div>

            {/* Quick area suggestions */}
            <div className="mt-3 pt-3 border-t border-slate-700 md:border-[#F1F5F9] flex flex-col md:flex-row md:items-center gap-2 text-xs">
              <div className="flex md:flex-wrap items-center overflow-x-auto no-scrollbar gap-2 py-1">
                <span className="font-semibold text-slate-300 md:text-[#111827] shrink-0 mr-0.5">
                  Quick hubs:
                </span>
                {['Prayagraj', 'Lucknow', 'Delhi / NCR', 'Mumbai', 'Bengaluru', 'Pune'].map(
                  (city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setSelectedLocality(city);
                        onSearch(city);
                      }}
                      className="shrink-0 whitespace-nowrap px-3 py-1.5 md:py-1 rounded-lg bg-slate-700/80 md:bg-[#F8FAFC] hover:bg-slate-700 md:hover:bg-[#F1F5F9] text-slate-200 md:text-[#334155] border border-slate-600 md:border-[#E2E8F0] transition-colors font-medium cursor-pointer"
                    >
                      {city}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Trust Guarantees Row */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 mt-10 text-xs text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
              <span>Mobile &amp; Platform Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#F59E0B]" />
              <span>Phone Numbers Private by Default</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#F59E0B]" />
              <span>Continuous Proximity Ranking</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BROWSE BY PROPERTY TYPE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-1">
              Explore Housing Options
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#101828] font-heading">
              Browse by Accommodation Type
            </h2>
          </div>
          <button
            onClick={() => onNavigate('search')}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#101828] hover:text-[#F59E0B] transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {propertyTypes.map((pt) => (
            <button
              key={pt.id}
              onClick={() => {
                if (pt.id === 'roommates') onNavigate('roommates');
                else onSearch(selectedLocality || '', pt.id);
              }}
              className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#F59E0B] hover:shadow-md transition-all text-left flex flex-col justify-between group"
            >
              <div className="text-2xl sm:text-3xl mb-3 group-hover:scale-110 transition-transform">
                {pt.icon}
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#111827] group-hover:text-[#101828] font-heading">
                  {pt.name}
                </h3>
                <span className="text-[11px] text-[#667085]">{pt.count}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. POPULAR CITIES & HUBS ACROSS INDIA */}
      <section id="cities" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-1">
              Nationwide Living Network
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#101828] font-heading">
              Popular Cities &amp; Hubs Across India
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {INDIAN_CITIES.slice(0, 4).map((city) => (
            <div
              key={city.id}
              onClick={() => onSearch(city.name)}
              className="group relative rounded-2xl overflow-hidden shadow-xs hover:shadow-lg transition-all cursor-pointer h-64 flex flex-col justify-end p-5"
            >
              <img
                src={city.image_url}
                alt={city.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101828] via-[#101828]/60 to-transparent" />

              <div className="relative z-10 text-white">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-bold font-heading">{city.name}</h3>
                    <span className="text-xs text-[#FDE68A]">{city.state_name}</span>
                  </div>
                  <span className="text-[11px] font-bold bg-[#F59E0B] text-[#101828] px-2 py-0.5 rounded-full">
                    {city.active_listings_count} rooms
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1] line-clamp-2 mb-2">
                  {city.popular_for}
                </p>
                <div className="text-[11px] text-[#FDE68A] font-medium flex items-center gap-1">
                  <span>Explore Rooms in {city.name} →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURED / VERIFIED PROPERTIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-1">
              Handpicked Accommodations
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#101828] font-heading">
              Featured Verified Properties
            </h2>
          </div>
          <button
            onClick={() => onNavigate('search')}
            className="flex items-center gap-1 text-sm font-semibold text-[#101828] hover:text-[#F59E0B] transition-colors"
          >
            <span>Explore All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProperties.slice(0, 6).map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onSelect={onSelectProperty}
            />
          ))}
        </div>
      </section>

      {/* 5. ROOMMATE DISCOVERY BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#101828] rounded-3xl p-6 sm:p-10 lg:p-12 text-white relative overflow-hidden border border-[#1E293B]">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-[#F59E0B]/10 blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#F59E0B] text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Roommate Discovery Platform</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black font-heading tracking-tight leading-tight mb-4">
                Don't want to pay full rent alone?
              </h2>
              <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed mb-6">
                Connect with compatible students and aspirants preparing for civil services, pursuing university degrees, or working across Indian hubs. Match based on sleep schedules, study habits, food preferences, and budget.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => onNavigate('roommates')}
                  icon={<Users className="w-5 h-5" />}
                  className="font-bold"
                >
                  Find a Roommate
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onNavigate('roommates')}
                  className="bg-transparent text-white border-white/20 hover:bg-white/10"
                >
                  Browse Roommate Profiles
                </Button>
              </div>
            </div>

            {/* Roommate preview cards */}
            <div className="space-y-3">
              {sampleRoommates.slice(0, 2).map((rm) => (
                <div
                  key={rm.id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={rm.avatar_url}
                      alt={rm.full_name}
                      className="w-11 h-11 rounded-xl object-cover ring-1 ring-white/20 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-sm text-white">{rm.full_name}</div>
                      <div className="text-xs text-[#94A3B8]">{rm.college}</div>
                      <div className="text-[11px] text-[#F59E0B] mt-0.5">
                        Target: ₹{rm.budget_min}–₹{rm.budget_max} • {rm.preferred_areas[0]}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-2.5 py-1 rounded-full border border-[#F59E0B]/20 shrink-0">
                    92% Match
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHY CHOOSE RENTED THIKAN (TRUST PILLARS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-2">
            Nationwide Trust &amp; Safety
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#101828] font-heading">
            Why Choose Rented Thikan?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#FFFBEB] flex items-center justify-center text-[#92400E] mb-4">
              <ShieldCheck className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <h3 className="font-bold text-base text-[#101828] font-heading mb-2">
              Verified Properties
            </h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Every accommodation includes verified photos, clear electricity billing rules, and upfront security deposit details to avoid surprise charges.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] flex items-center justify-center text-[#C2410C] mb-4">
              <PhoneOff className="w-6 h-6 text-[#F97316]" />
            </div>
            <h3 className="font-bold text-base text-[#101828] font-heading mb-2">
              Privacy-First Contact
            </h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Phone numbers are never publicly broadcasted by default. Communicate via secure in-app messaging, or unlock phone numbers only after mutual contact request acceptance.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#334155] mb-4">
              <MapPin className="w-6 h-6 text-[#101828]" />
            </div>
            <h3 className="font-bold text-base text-[#101828] font-heading mb-2">
              Proximity-Based Discovery
            </h3>
            <p className="text-xs text-[#667085] leading-relaxed">
              Search by your exact coaching centre, library, or college gate. Our continuous Haversine distance engine lists nearest options first before seamlessly expanding.
            </p>
          </div>
        </div>
      </section>

      {/* 7. HOW IT WORKS (SEEKERS & LISTERS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] py-12 rounded-3xl border border-[#E2E8F0]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Find Your Place */}
          <div className="space-y-4">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-[#101828] bg-white px-3 py-1 rounded-full border border-[#E2E8F0]">
              Find Your Place
            </div>
            <h3 className="text-xl font-bold text-[#101828] font-heading">
              Find Your Room in 5 Easy Steps
            </h3>
            <div className="space-y-3 pt-2">
              {[
                { step: '1', title: 'Select City or Area', desc: 'Choose your city and locality, or auto-detect with one tap.' },
                { step: '2', title: 'Compare Verified Options', desc: 'Filter by rent, Wi-Fi, food, gender, or attached washroom.' },
                { step: '3', title: 'Inquire In-Platform', desc: 'Send a message directly to the lister without exposing your personal phone number.' },
                { step: '4', title: 'Request Contact or Visit', desc: 'Exchange contact details securely and schedule an in-person room visit.' },
                { step: '5', title: 'Move In & Stay Safe', desc: 'Finalize your stay with transparent pricing and no broker commissions.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#101828] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#111827]">{item.title}</h4>
                    <p className="text-[11px] text-[#667085]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* List a Property / Room */}
          <div className="space-y-4">
            <div className="inline-block text-xs font-bold uppercase tracking-wider text-[#F59E0B] bg-[#FFFBEB] px-3 py-1 rounded-full border border-[#FDE68A]">
              List a Property / Room
            </div>
            <h3 className="text-xl font-bold text-[#101828] font-heading">
              Offer Your Vacancy to Verified Members
            </h3>
            <div className="space-y-3 pt-2">
              {[
                { step: '1', title: 'Quick Member Setup', desc: 'Use your verified Rented Thikan member account with zero hassle.' },
                { step: '2', title: 'Upload Photos & Set Rent', desc: 'Add room photos, select amenities, and define house rules.' },
                { step: '3', title: 'Control Phone Privacy', desc: 'Decide whether your phone number is private, on-request, or public.' },
                { step: '4', title: 'Receive Direct Member Inquiries', desc: 'Chat with genuine university and coaching aspirants.' },
                { step: '5', title: 'Manage Vacancies Anytime', desc: 'Mark rooms rented or pause anytime with a single tap from your dashboard.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#F59E0B] text-[#101828] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#111827]">{item.title}</h4>
                    <p className="text-[11px] text-[#667085]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. BOTTOM CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#172554] to-[#101828] text-white flex flex-col md:flex-row items-center justify-between gap-6 border border-[#1E293B]">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-heading mb-2">
              Have a room, flat, or PG to offer?
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-lg">
              List your room, PG, or flat for free. Connect directly with verified seekers and students across Indian cities without broker fees.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => onNavigate('add-property')}
            icon={<PlusCircle className="w-5 h-5" />}
            className="shrink-0 font-bold cursor-pointer"
          >
            List a Room / Property
          </Button>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import {
  ArrowLeft,
  Heart,
  Share2,
  ShieldCheck,
  MapPin,
  Lock,
  Phone,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Check,
  Ban,
} from 'lucide-react';
import { Property } from '../types';
import { useSaved } from '../context/SavedContext';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { DistanceBadge } from '../components/property/DistanceBadge';
import { WeatherBadge } from '../components/property/WeatherBadge';
import { ContactRequestModal } from '../components/safety/ContactRequestModal';
import { ReportModal } from '../components/safety/ReportModal';
import { PropertyMap } from '../components/map/PropertyMap';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AMENITIES_CATALOG, RULES_CATALOG } from '../config/brand';

interface PropertyDetailPageProps {
  property: Property;
  onBack: () => void;
}

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property,
  onBack,
}) => {
  const { isSaved, toggleSave } = useSaved();
  const { openChatWithContext } = useChat();
  const { requireAuth } = useAuth();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Memoize map data to prevent Leaflet re-rendering cycles during scroll
  const mapProperties = React.useMemo(() => [property], [property]);
  const mapCenter = React.useMemo(
    () => ({
      latitude: property.display_latitude || 25.4563,
      longitude: property.display_longitude || 81.8546,
    }),
    [property.display_latitude, property.display_longitude]
  );

  // Defer heavy Leaflet map instantiation until after initial transition settles (preserves 60 FPS)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  const saved = isSaved(property.id);

  // Phone privacy authorization check:
  // Authorized if public OR accepted contact request OR owner's own phone
  const isPhoneAuthorized =
    property.phone_privacy === 'public' ||
    property.contact_request_status === 'accepted' ||
    Boolean(property.owner_phone);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const images = property.images.length > 0 ? property.images : [
    { id: '1', url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80', is_cover: true }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            const url = new URL(window.location.href);
            if ((url.searchParams.has('room') || url.searchParams.has('roomId')) && window.history.length > 1) {
              window.history.back();
            } else {
              onBack();
            }
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#101828] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to listings</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            title="Share Property Link"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (requireAuth('Sign in with Google to save properties to your favorites.', { type: 'property-detail', propertyId: property.id, property })) {
                toggleSave(property);
              }
            }}
            className="p-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            title={saved ? 'Remove from saved' : 'Save Property'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                saved ? 'fill-[#F97316] text-[#F97316]' : 'text-[#475569]'
              }`}
            />
          </button>
          <button
            onClick={() => {
              if (requireAuth('Sign in with Google to report a property listing.')) {
                setIsReportModalOpen(true);
              }
            }}
            className="p-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#475569] hover:text-rose-600 transition-colors cursor-pointer"
            title="Report this listing"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copiedLink && (
        <div className="mb-4 p-2.5 bg-[#FFFBEB] text-[#92400E] text-xs font-semibold rounded-xl text-center border border-[#FDE68A] animate-in fade-in">
          Property link copied to clipboard!
        </div>
      )}

      {/* Protected Main Grid: Gallery & Details on Left, Sticky Booking/Contact on Right */}
      <ProtectedRoute
        fallbackTitle="Sign in to view complete room details"
        fallbackDescription="Full room photos, exact address, contact details, and owner chat are protected for verified students and members."
        pendingAction={{ type: 'property-detail', propertyId: property.id, property }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Gallery & Property Information */}
        <div className="lg:col-span-2 space-y-8">
          {/* 1. Large Image Gallery */}
          <div className="space-y-3">
            <div className="relative h-72 sm:h-96 w-full rounded-2xl overflow-hidden bg-[#F1F5F9] border border-[#E5E7EB]">
              <img
                src={images[activeImageIndex]?.url}
                alt={property.title}
                decoding="async"
                className="w-full h-full object-cover transition-opacity duration-200"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {property.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-white/95 text-[#101828] shadow-xs max-md:bg-white md:backdrop-blur-xs">
                    <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
                    Platform Verified
                  </span>
                )}
                {property.is_demo && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-900/90 text-white max-md:bg-slate-900 md:backdrop-blur-xs">
                    Demo Fictional Record
                  </span>
                )}
              </div>
              <div className="absolute bottom-3 right-3 bg-black/75 max-md:bg-black/85 md:backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-lg">
                {activeImageIndex + 1} / {images.length} Photos
              </div>
            </div>

            {/* Thumbnail Row */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      activeImageIndex === idx
                        ? 'border-[#F59E0B] shadow-xs'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Header & Title Section */}
          <div className="pb-6 border-b border-[#E5E7EB]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] bg-[#FFFBEB] px-2.5 py-1 rounded-md border border-[#FDE68A]">
                {property.property_type.replace('_', ' ').toUpperCase()} •{' '}
                {property.gender_preference.toUpperCase()}
              </span>
              <DistanceBadge distanceFormatted={property.distance_formatted} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#101828] font-heading mb-2">
              {property.title}
            </h1>

            <div className="flex items-center gap-1.5 text-sm text-[#667085]">
              <MapPin className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span>{property.locality}{property.city ? ', ' + property.city : ''}</span>
              {property.landmark && <span>• Near {property.landmark}</span>}
            </div>

            {/* Local Climate & Season Advisory (Open-Meteo Public API) */}
            <div className="mt-3">
              <WeatherBadge
                latitude={property.latitude}
                longitude={property.longitude}
                locality={property.locality}
              />
            </div>
          </div>

          {/* 3. Transparent Pricing & Charges Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] space-y-4">
            <h3 className="font-bold text-base text-[#101828] font-heading">
              Transparent Pricing Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-0.5">
                  Monthly Rent
                </span>
                <span className="text-xl font-extrabold text-[#101828] font-heading">
                  ₹{property.rent.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-[#94A3B8] block">Per bed / month</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-0.5">
                  Security Deposit
                </span>
                <span className="text-base font-bold text-[#101828]">
                  ₹{property.security_deposit.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-[#92400E] font-medium block">100% Refundable</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-0.5">
                  Electricity
                </span>
                <span className="text-xs font-semibold text-[#101828]">
                  {property.electricity_billing === 'included'
                    ? 'Free / Included'
                    : `₹${property.electricity_rate_per_unit || 9} / Unit`}
                </span>
                <span className="text-[10px] text-[#94A3B8] block">Sub-meter billing</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-0.5">
                  Maintenance
                </span>
                <span className="text-xs font-semibold text-[#101828]">
                  {property.maintenance_fee === 0 ? '₹0 / None' : `₹${property.maintenance_fee}/mo`}
                </span>
                <span className="text-[10px] text-[#94A3B8] block">Cleaning &amp; waste</span>
              </div>
            </div>
          </div>

          {/* 4. Room Specifications */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] space-y-4">
            <h3 className="font-bold text-base text-[#101828] font-heading">
              Room &amp; Occupancy Specs
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#111827]">Occupancy:</span>
                <span className="capitalize">{property.room_type} Sharing</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#111827]">Furnishing:</span>
                <span className="capitalize">{property.furnishing_status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#111827]">Attached Bath:</span>
                <span>{property.attached_bathroom ? 'Yes (Western)' : 'Common Clean'}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#111827]">Vacancies:</span>
                <span className="font-bold text-amber-600">{property.vacancies} Bed(s) Available</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#111827]">Available From:</span>
                <span>{property.available_from}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="font-semibold text-[#111827]">Floor:</span>
                <span>Floor {property.floor || 1} of {property.total_floors || 2}</span>
              </div>
            </div>
          </div>

          {/* 5. Description */}
          <div className="space-y-3">
            <h3 className="font-bold text-base text-[#101828] font-heading">About This Accommodation</h3>
            <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* 6. Amenities Grid */}
          <div className="space-y-4">
            <h3 className="font-bold text-base text-[#101828] font-heading">Amenities Included</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AMENITIES_CATALOG.map((a) => {
                const isIncluded = property.amenities.includes(a.id);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs ${
                      isIncluded
                        ? 'bg-white border-[#E2E8F0] text-[#111827] font-medium'
                        : 'bg-[#F8FAFC]/50 border-transparent text-[#94A3B8] opacity-50'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        isIncluded ? 'text-[#D97706]' : 'text-slate-300'
                      }`}
                    />
                    <span>{a.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. House Rules */}
          <div className="space-y-4">
            <h3 className="font-bold text-base text-[#101828] font-heading">House &amp; Gate Rules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {RULES_CATALOG.map((rule) => {
                const applies = property.rules.includes(rule.id);
                return (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                      applies
                        ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E] font-medium'
                        : 'bg-white border-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    {applies ? (
                      <Check className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                    ) : (
                      <Ban className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span>{rule.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8. Approximate Neighborhood Location Map */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
              <div>
                <h3 className="font-bold text-base text-[#101828] font-heading">
                  Neighborhood Area: {property.locality}{property.city ? ', ' + property.city : ''}
                </h3>
                <p className="text-xs text-[#667085]">
                  {property.landmark ? `In the vicinity of ${property.landmark}` : 'Central student accommodation sector'}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#92400E] bg-[#FFFBEB] px-2.5 py-1 rounded-full border border-[#FDE68A] flex items-center gap-1.5 self-start sm:self-center">
                <Lock className="w-3 h-3 text-[#F59E0B]" />
                Approximate location shown for privacy
              </span>
            </div>

            {/* Location Privacy State */}
            {property.is_exact_location_shared ? (
              <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-[#D97706]" />
                  </div>
                  <div>
                    <span className="font-bold text-[#92400E] text-xs sm:text-sm block">
                      Exact location shared privately in chat
                    </span>
                    <span className="text-[11px] text-[#78350F]">
                      Doorstep navigation details are protected and kept inside your conversation thread.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openChatWithContext({
                      id: property.id,
                      title: property.title,
                      locality: property.locality,
                      rent: property.rent,
                      owner_id: property.owner_id,
                      owner_name: property.owner_name,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101828] text-white text-[11px] font-semibold hover:bg-[#1E293B] transition-colors shadow-2xs self-start sm:self-center shrink-0 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Open Location in Chat</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#64748B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                  <span>
                    Exact doorstep address is kept private. Message the host to receive navigation directions.
                  </span>
                </div>
              </div>
            )}

            {isMapReady ? (
              <PropertyMap
                properties={mapProperties}
                centerCoordinates={mapCenter}
                className="h-64 w-full rounded-2xl"
              />
            ) : (
              <div className="h-64 w-full rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <MapPin className="w-5 h-5 text-amber-500 animate-pulse" />
                <span>Loading vicinity map...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Sticky Contact & Safety Card */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 relative bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-md space-y-6">
            {/* Price Header */}
            <div className="pb-4 border-b border-[#F1F5F9]">
              <div className="text-xs text-[#667085]">Total Rent</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-black text-[#101828] font-heading">
                  ₹{property.rent.toLocaleString('en-IN')}
                </span>
                <span className="text-sm text-[#667085]">/ month</span>
              </div>
              <span className="inline-block mt-2 text-[11px] font-semibold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-md">
                Zero Brokerage Commission
              </span>
            </div>

            {/* Lister / Member Info Box */}
            <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
              <img
                src={
                  property.lister_avatar ||
                  property.owner_avatar ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                }
                alt={property.lister_name || property.owner_name}
                className="w-12 h-12 rounded-xl object-cover ring-1 ring-[#CBD5E1]"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-[#111827] truncate">
                  {property.lister_name || property.owner_name}
                </h4>
                <p className="text-[11px] text-[#667085]">Listed by Member</p>
                <div className="text-[10px] text-[#F59E0B] font-semibold flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Member
                </div>
              </div>
            </div>

            {/* Strict Phone Privacy Display Box */}
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#101828]">Phone Contact:</span>
                {isPhoneAuthorized ? (
                  <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                    Unlocked
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Hidden
                  </span>
                )}
              </div>

              {isPhoneAuthorized && (property.lister_phone || property.owner_phone) ? (
                <div className="p-3 bg-[#FFFBEB] rounded-xl border border-[#FDE68A] text-center">
                  <div className="text-xs text-[#92400E] font-semibold mb-1">
                    Lister Direct Phone:
                  </div>
                  <a
                    href={`tel:${property.lister_phone || property.owner_phone}`}
                    className="text-base font-bold text-[#101828] hover:text-[#D97706] hover:underline flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-4 h-4 text-[#F59E0B]" />
                    {property.lister_phone || property.owner_phone}
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] text-center text-xs text-[#667085] leading-relaxed">
                  <Lock className="w-4 h-4 text-[#F59E0B] mx-auto mb-1" />
                  <span>
                    Phone number is protected. Message directly in-platform or request phone exchange.
                  </span>
                </div>
              )}
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() =>
                  openChatWithContext({
                    id: property.id,
                    title: property.title,
                    locality: property.locality,
                    rent: property.rent,
                    owner_id: property.owner_id,
                    owner_name: property.lister_name || property.owner_name,
                  })
                }
                icon={<MessageSquare className="w-5 h-5" />}
                className="font-bold"
              >
                Message Lister
              </Button>

              {!isPhoneAuthorized && (
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => {
                    if (
                      requireAuth(
                        'Sign in with Google to request direct phone contact from the property owner.',
                        { type: 'property-detail', propertyId: property.id, property }
                      )
                    ) {
                      setIsContactModalOpen(true);
                    }
                  }}
                  icon={<Phone className="w-4 h-4 text-[#F59E0B]" />}
                >
                  Request Phone Contact
                </Button>
              )}
            </div>

            {/* Safety & Anti-Scam Disclaimer */}
            <div className="text-[11px] text-[#94A3B8] leading-normal pt-2 border-t border-[#F1F5F9] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <span>
                Never transfer booking or token advances without inspecting the room in person. Report suspicious demands immediately.
              </span>
            </div>
          </div>
        </div>
        </div>
      </ProtectedRoute>

      {/* Modals */}
      <ContactRequestModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        property={property}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        entityType="property"
        entityId={property.id}
        entityName={property.title}
      />
    </div>
  );
};

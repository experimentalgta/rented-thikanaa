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
import { ReportModal } from '../components/safety/ReportModal';
import { PropertyMap } from '../components/map/PropertyMap';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AMENITIES_CATALOG, RULES_CATALOG } from '../config/brand';
import { getThumbnailUrl } from '../utils/imageProcessor';
import { getPhoneContactDetails } from '../utils/phoneUtils';
import { propertyRepository } from '../services/propertyRepository';

interface PropertyDetailPageProps {
  property: Property;
  onBack: () => void;
}

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property: initialProperty,
  onBack,
}) => {
  const [property, setProperty] = useState<Property>(initialProperty);

  const { isSaved, toggleSave } = useSaved();
  const { openChatForListing } = useChat();
  const { currentUser, requireAuth } = useAuth();

  // Sync state if initialProperty prop changes
  React.useEffect(() => {
    setProperty(initialProperty);
  }, [initialProperty]);

  // Proactively fetch latest property details (including owner contact data)
  React.useEffect(() => {
    if (initialProperty?.id) {
      propertyRepository
        .getPropertyById(initialProperty.id, currentUser?.id)
        .then((fresh) => {
          if (fresh) {
            setProperty(fresh);
          }
        })
        .catch((err) => {
          console.warn('Could not refresh property details:', err);
        });
    }
  }, [initialProperty?.id, currentUser?.id]);

  const isOwner = Boolean(
    currentUser?.id &&
    (property.owner_id === currentUser.id || property.created_by === currentUser.id)
  );

  const [activeImageIndex, setActiveImageIndex] = useState(0);
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

  // Direct Phone Authorization:
  // Authorized if listing host selected show_phone_number === true (or phone_privacy === 'public')
  // OR current user is the listing owner
  const isPhoneAuthorized =
    property.show_phone_number === true ||
    property.phone_privacy === 'public' ||
    isOwner;

  const rawPhone =
    property.phone_number ||
    property.lister_phone ||
    property.owner_phone ||
    (isOwner ? currentUser?.phone_number : null);

  const contactDetails =
    isPhoneAuthorized && rawPhone
      ? getPhoneContactDetails(rawPhone, property.title)
      : null;

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
                    <img
                      src={img.thumbnail_url || getThumbnailUrl(img.url)}
                      alt={`Thumbnail ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
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
                  onClick={() => openChatForListing(property)}
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

            {/* Direct Phone & Contact Details Box */}
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#101828]">Direct Contact:</span>
                {contactDetails ? (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Phone Visible
                  </span>
                ) : isPhoneAuthorized ? (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-amber-600" /> Phone Enabled
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-slate-500" /> Private
                  </span>
                )}
              </div>

              {contactDetails ? (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 text-center shadow-xs">
                  <div className="text-[11px] text-[#64748B] font-medium mb-1">
                    Host Direct Phone:
                  </div>
                  <a
                    href={contactDetails.telUrl}
                    className="text-base font-bold text-[#101828] hover:text-[#D97706] hover:underline flex items-center justify-center gap-1.5 font-heading"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>{contactDetails.formattedDisplay}</span>
                  </a>
                </div>
              ) : isOwner && isPhoneAuthorized ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs text-amber-800 leading-relaxed">
                  <Phone className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                  <span>
                    Phone visibility is enabled for this listing, but no mobile number is on file. Please update your phone number in Settings to display Call and WhatsApp buttons.
                  </span>
                </div>
              ) : isPhoneAuthorized ? (
                <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] text-center text-xs text-[#667085] leading-relaxed">
                  <MessageSquare className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <span>
                    Direct contact via in-app message. You can message the host directly below.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-[#E2E8F0] text-center text-xs text-[#667085] leading-relaxed">
                  <Lock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <span>
                    Phone number is kept private by host. You can message them directly below.
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
                disabled={isOwner}
                onClick={() => openChatForListing(property)}
                icon={<MessageSquare className="w-5 h-5" />}
                className="font-bold"
              >
                {isOwner ? 'You Listed this Room' : 'Message Lister'}
              </Button>

              {/* Direct Call & WhatsApp buttons when host enables phone */}
              {contactDetails && !isOwner && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={contactDetails.telUrl}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
                    title={`Call host at ${contactDetails.formattedDisplay}`}
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Call Host</span>
                  </a>

                  <a
                    href={contactDetails.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#20ba59] transition-colors shadow-xs"
                    title="Chat on WhatsApp"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                </div>
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

import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  IndianRupee,
  Sparkles,
  Camera,
  ShieldCheck,
  Eye,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  X,
  Lock,
  Phone,
  Navigation,
  Loader2,
  Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { PropertyCard } from '../components/property/PropertyCard';
import { Property, PropertyType, GenderPreference, RoomType, PhonePrivacy } from '../types';
import { locationRepository } from '../services/locationRepository';
import { evaluateLocationAccuracy } from '../services/location/locationAccuracy';
import { AMENITIES_CATALOG, RULES_CATALOG } from '../config/brand';
import { propertyRepository } from '../services/propertyRepository';
import { LocationPickerMap } from '../components/map/LocationPickerMap';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

interface AddPropertyPageProps {
  onSuccess: (newProperty: Property) => void;
  onCancel: () => void;
}

const DRAFT_STORAGE_KEY = 'rented_thikan_owner_draft_v1';

export const AddPropertyPage: React.FC<AddPropertyPageProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  // Form State initialized with draft if present
  const [formData, setFormData] = useState<Partial<Property>>(() => {
    try {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) return JSON.parse(draft);
    } catch (e) {}
    return {
      title: '',
      property_type: 'pg',
      gender_preference: 'male',
      room_type: 'double',
      country: 'India',
      state: '',
      state_code: '',
      city: '',
      city_slug: '',
      locality: '',
      locality_slug: '',
      sub_locality: '',
      landmark: '',
      address: '',
      latitude: undefined,
      longitude: undefined,
      rent: 5500,
      security_deposit: 5500,
      electricity_billing: 'included',
      electricity_rate_per_unit: 9,
      maintenance_fee: 0,
      available_from: 'Immediately',
      vacancies: 2,
      furnishing_status: 'fully_furnished',
      attached_bathroom: true,
      balcony: false,
      amenities: ['wifi', 'ro_water', 'power_backup', 'food_available', 'study_table'],
      rules: ['gate_timings', 'no_smoking', 'quiet_hours'],
      phone_privacy: 'private', // Default private by specification
      owner_phone: currentUser?.phone_number || '',
      images: [
        {
          id: 'img-seed-1',
          url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80',
          caption: 'Spacious study bedroom',
          is_cover: true,
        },
      ],
      description: '',
    };
  });

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lister Location Intelligence & Adjustment State
  const [isGpsDetecting, setIsGpsDetecting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showMapAdjustment, setShowMapAdjustment] = useState(true);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [locationMethod, setLocationMethod] = useState<'search' | 'gps' | 'map'>('search');
  const [accuracyLabel, setAccuracyLabel] = useState<string>('Location set manually');
  const [searchLocationQuery, setSearchLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const handleUseCurrentGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported on this device/browser.');
      return;
    }

    setIsGpsDetecting(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let revState = '';
        let revStateCode = '';
        let revCity = '';
        let revCitySlug = '';
        let revLocality = '';
        let revLocalitySlug = '';
        let revLandmark: string | undefined = undefined;

        try {
          const rev = await locationRepository.reverseGeocodeAsync(latitude, longitude);
          revState = rev.state || '';
          revStateCode = rev.stateCode || '';
          revCity = rev.city || '';
          revCitySlug = rev.citySlug || '';
          revLocality = rev.locality || '';
          revLocalitySlug = rev.localitySlug || '';
          revLandmark = rev.landmark;
        } catch {
          const rev = locationRepository.reverseGeocode(latitude, longitude);
          revState = rev.stateName;
          revStateCode = rev.stateCode;
          revCity = rev.cityName;
          revCitySlug = rev.citySlug;
          revLocality = rev.localityName;
          revLocalitySlug = rev.localitySlug || '';
          revLandmark = rev.nearestLandmark;
        }

        const evalAcc = evaluateLocationAccuracy(accuracy, 'gps');

        setFormData((prev) => ({
          ...prev,
          country: 'India',
          state: revState || prev.state,
          state_code: revStateCode || prev.state_code,
          city: revCity || prev.city,
          city_slug: revCitySlug || prev.city_slug,
          locality: revLocality || prev.locality,
          locality_slug: revLocalitySlug || prev.locality_slug,
          landmark: revLandmark ? `Near ${revLandmark}` : prev.landmark,
          latitude,
          longitude,
        }));

        setIsGpsDetecting(false);
        setShowMapAdjustment(true);
        setIsLocationConfirmed(false);
        setLocationMethod('gps');
        setAccuracyLabel(`Approximate GPS accuracy: ${Math.round(accuracy)} m`);

        if (evalAcc.isLowAccuracy && evalAcc.warningMessage) {
          setGpsError(evalAcc.warningMessage);
        } else {
          setGpsError(null);
        }
      },
      (err) => {
        setIsGpsDetecting(false);
        if (err.code === 1) {
          setGpsError('Location access was denied. You can select your state, city, and area manually below.');
        } else if (err.code === 2) {
          setGpsError("Could not detect GPS location. Please select your area or adjust on map.");
        } else if (err.code === 3) {
          setGpsError('Location request timed out. Please select your area manually.');
        } else {
          setGpsError("Could not detect GPS location. Please select your area manually.");
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  };

  // Auto-save draft on form changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {}
  }, [formData]);

  const updateField = (field: keyof Property, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleAmenityToggle = (id: string) => {
    const current = formData.amenities || [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    updateField('amenities', next);
  };

  const handleRuleToggle = (id: string) => {
    const current = formData.rules || [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    updateField('rules', next);
  };

  const handleAddImage = () => {
    if (!imageUrlInput.trim()) return;
    const newImg = {
      id: `img-${Date.now()}`,
      url: imageUrlInput.trim(),
      caption: 'Room Photo',
      is_cover: (formData.images || []).length === 0,
    };
    updateField('images', [...(formData.images || []), newImg]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (imgId: string) => {
    const next = (formData.images || []).filter((i) => i.id !== imgId);
    updateField('images', next);
  };

  const handlePublish = async () => {
    if (!formData.locality?.trim()) {
      alert("Please enter your property's area/locality before publishing.");
      setCurrentStep(2);
      return;
    }
    if (!formData.city?.trim()) {
      alert("Please select a city before publishing.");
      setCurrentStep(2);
      return;
    }
    if (!formData.state?.trim()) {
      alert("Please select a state before publishing.");
      setCurrentStep(2);
      return;
    }

    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const created = await propertyRepository.createProperty({
        ...formData,
        owner_id: currentUser.id,
        owner_name: currentUser.full_name,
        created_by: currentUser.id,
        lister_name: currentUser.full_name,
        lister_phone: currentUser.phone_number,
        lister_avatar: currentUser.avatar_url,
      });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      onSuccess(created);
    } catch (e) {
      console.error('Publish listing failed', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Construct a preview property representation for the live student preview
  const previewProperty: Property = {
    id: 'preview-sample',
    owner_id: currentUser?.id || 'pending',
    owner_name: currentUser?.full_name || 'Owner',
    owner_phone: formData.phone_privacy === 'public' ? formData.owner_phone : null,
    created_by: currentUser?.id || 'pending',
    lister_name: currentUser?.full_name || 'Owner',
    lister_phone: formData.phone_privacy === 'public' ? formData.owner_phone : null,
    lister_avatar: currentUser?.avatar_url || '',
    title: formData.title || 'Student Accommodation Title',
    slug: 'preview',
    description: formData.description || 'Description will be shown to students here.',
    property_type: (formData.property_type as PropertyType) || 'pg',
    gender_preference: (formData.gender_preference as GenderPreference) || 'any',
    room_type: (formData.room_type as RoomType) || 'double',
    rent: Number(formData.rent) || 5000,
    security_deposit: Number(formData.security_deposit) || 5000,
    electricity_billing: formData.electricity_billing || 'included',
    maintenance_fee: Number(formData.maintenance_fee) || 0,
    available_from: formData.available_from || 'Immediately',
    vacancies: Number(formData.vacancies) || 1,
    furnishing_status: formData.furnishing_status || 'semi_furnished',
    attached_bathroom: Boolean(formData.attached_bathroom),
    balcony: Boolean(formData.balcony),
    availability_status: 'available',
    is_verified: true,
    verification_badge: 'platform_verified',
    is_featured: false,
    is_demo: false,
    locality: formData.locality || 'Locality',
    landmark: formData.landmark,
    city: formData.city || 'City',
    state: formData.state || 'State',
    pincode: formData.pincode || '',
    address: formData.address || 'Address',
    latitude: formData.latitude,
    longitude: formData.longitude,
    amenities: formData.amenities || ['wifi'],
    rules: formData.rules || ['quiet_hours'],
    images: formData.images || [],
    phone_privacy: (formData.phone_privacy as PhonePrivacy) || 'private',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    distance_formatted: 'In your locality',
  };

  return (
    <ProtectedRoute
      fallbackTitle="Sign in to list your accommodation"
      fallbackDescription="Please sign in with Google to create and publish verified rooms, PGs, or student flats."
      pendingAction={{ type: 'add-property' }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28">
      {/* Wizard Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider">
              Step {currentStep} of {totalSteps}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#101828] font-heading">
              {currentStep === 1 && 'Basic Property Information'}
              {currentStep === 2 && 'Location & Landmarks in Prayagraj'}
              {currentStep === 3 && 'Rent, Deposit & Billing'}
              {currentStep === 4 && 'Room Specs & Amenities'}
              {currentStep === 5 && 'House & Gate Rules'}
              {currentStep === 6 && 'Photos & Cover Image'}
              {currentStep === 7 && 'Phone Privacy & Student Live Preview'}
            </h1>
          </div>
          <button
            onClick={onCancel}
            className="text-xs text-[#667085] hover:text-[#101828] font-medium"
          >
            Cancel
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#101828] h-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Step Container */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 shadow-xs space-y-6">
        {/* STEP 1: BASICS */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Property Name / Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g. Sunrise Student PG & Co-Living or Modern 2BHK Flat"
                className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Property Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'pg', label: 'Student PG', desc: 'Managed PG with facilities' },
                  { id: 'hostel', label: 'Student Hostel', desc: 'Hostel with mess & warden' },
                  { id: 'room', label: 'Independent Room', desc: 'Single room in family house' },
                  { id: 'flat', label: 'Flat / 1BHK / 2BHK', desc: 'Apartment for sharing' },
                  { id: 'shared_room', label: 'Shared Room', desc: 'Bed sharing in room' },
                  { id: 'homestay', label: 'Homestay', desc: 'Living with local family' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateField('property_type', type.id)}
                    className={`p-3 rounded-2xl text-left border transition-all ${
                      formData.property_type === type.id
                        ? 'border-[#101828] bg-[#F8FAFC]'
                        : 'border-[#E5E7EB] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#111827]">{type.label}</div>
                    <div className="text-[10px] text-[#667085] mt-0.5">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Gender Suitability
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'male', label: 'Boys Only' },
                  { id: 'female', label: 'Girls Only' },
                  { id: 'any', label: 'Co-ed / Any' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => updateField('gender_preference', g.id)}
                    className={`p-3 rounded-xl text-center text-xs font-bold border transition-all ${
                      formData.gender_preference === g.id
                        ? 'bg-[#101828] text-white border-[#101828]'
                        : 'bg-[#F8FAFC] text-[#475569] border-[#E5E7EB]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Short Description for Students
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Mention highlights: silent study atmosphere, nearby library, healthy mess food, distance to Allahabad University..."
                className="w-full p-3 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 2: LOCATION */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Location Setting Method Selector */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-2xl">
              <div className="text-xs font-bold text-[#101828] mb-2 flex items-center justify-between">
                <span>Choose How to Set Location:</span>
                <span className="text-[11px] font-semibold text-[#D97706] bg-[#FEF3C7] px-2.5 py-0.5 rounded-full border border-[#FDE68A]">
                  ✓ {accuracyLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLocationMethod('search')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    locationMethod === 'search'
                      ? 'bg-[#101828] text-[#F59E0B] border-[#101828] shadow-xs'
                      : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Option A: Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationMethod('gps');
                    handleUseCurrentGps();
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    locationMethod === 'gps'
                      ? 'bg-[#101828] text-[#F59E0B] border-[#101828] shadow-xs'
                      : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span>Option B: Use GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMethod('map')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    locationMethod === 'map'
                      ? 'bg-[#101828] text-[#F59E0B] border-[#101828] shadow-xs'
                      : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Option C: Pick on Map</span>
                </button>
              </div>
            </div>

            {/* Quick GPS Capture Card */}
            {locationMethod === 'gps' && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#101828] to-[#1E293B] text-white p-4 sm:p-5 shadow-sm border border-white/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/30">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white font-heading flex items-center gap-2">
                        <span>Standing at the property right now?</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/20">
                          Fastest
                        </span>
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5 max-w-md">
                        Capture high-precision coordinates with one tap. Helps members find your property by exact walking distance.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleUseCurrentGps}
                    disabled={isGpsDetecting}
                    loading={isGpsDetecting}
                    icon={isGpsDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    className="shrink-0 font-semibold text-xs w-full sm:w-auto"
                  >
                    {isGpsDetecting ? 'Detecting coordinates...' : '📍 Use My Current Location'}
                  </Button>
                </div>

                {gpsError && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Option A: Search Bar for Quick Locality Selection */}
            {locationMethod === 'search' && (
              <div className="p-3 bg-white border border-[#E2E8F0] rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-[#101828]">
                  Search Area, Locality or Landmark across India:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchLocationQuery}
                    onChange={(e) => {
                      setSearchLocationQuery(e.target.value);
                      setIsSearchingLocation(true);
                    }}
                    placeholder="e.g. Andheri West, Koramangala, Laxmi Nagar, Katra..."
                    className="w-full p-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:border-[#F59E0B]"
                  />
                  {searchLocationQuery.trim().length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1">
                      {locationRepository.searchLocations(searchLocationQuery).slice(0, 6).map((res) => (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => {
                            updateField('state', res.state);
                            updateField('state_code', res.state_code);
                            updateField('city', res.city);
                            updateField('city_slug', res.city_slug);
                            updateField('locality', res.locality || res.city);
                            updateField('locality_slug', res.locality_slug);
                            updateField('latitude', res.latitude);
                            updateField('longitude', res.longitude);
                            setAccuracyLabel('Location selected from search');
                            setSearchLocationQuery('');
                            setIsSearchingLocation(false);
                            setIsLocationConfirmed(false);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-[#F8FAFC] text-xs font-semibold text-[#101828] flex items-center justify-between"
                        >
                          <span>{res.title}</span>
                          <span className="text-[10px] text-[#64748B]">{res.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manual Form Inputs with State -> City -> Locality Hierarchy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  State / UT *
                </label>
                <select
                  value={formData.state_code || ''}
                  onChange={(e) => {
                    const st = locationRepository.getStateByCode(e.target.value);
                    const cities = locationRepository.getCities(e.target.value);
                    const firstCity = cities[0];
                    updateField('state', st?.name || e.target.value);
                    updateField('state_code', e.target.value);
                    if (firstCity) {
                      updateField('city', firstCity.name);
                      updateField('city_slug', firstCity.slug);
                      const locs = locationRepository.getLocalities(firstCity.slug);
                      if (locs.length > 0) {
                        updateField('locality', locs[0].name);
                        updateField('locality_slug', locs[0].slug);
                        updateField('latitude', locs[0].latitude);
                        updateField('longitude', locs[0].longitude);
                      } else {
                        updateField('locality', '');
                        updateField('locality_slug', '');
                        updateField('latitude', firstCity.latitude);
                        updateField('longitude', firstCity.longitude);
                      }
                    } else {
                      updateField('city', '');
                      updateField('city_slug', '');
                      updateField('locality', '');
                      updateField('locality_slug', '');
                    }
                    setIsLocationConfirmed(false);
                  }}
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                >
                  <option value="">-- Select State / UT --</option>
                  {locationRepository.getStates().map((st) => (
                    <option key={st.id} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  City *
                </label>
                <select
                  value={formData.city_slug || ''}
                  onChange={(e) => {
                    const ct = locationRepository.getCityBySlugOrName(e.target.value);
                    if (ct) {
                      updateField('city', ct.name);
                      updateField('city_slug', ct.slug);
                      const locs = locationRepository.getLocalities(ct.slug);
                      if (locs.length > 0) {
                        updateField('locality', locs[0].name);
                        updateField('locality_slug', locs[0].slug);
                        updateField('latitude', locs[0].latitude);
                        updateField('longitude', locs[0].longitude);
                      } else {
                        updateField('locality', '');
                        updateField('locality_slug', '');
                        updateField('latitude', ct.latitude);
                        updateField('longitude', ct.longitude);
                      }
                      setIsLocationConfirmed(false);
                    }
                  }}
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                >
                  <option value="">-- Select City --</option>
                  {locationRepository.getCities(formData.state_code).map((ct) => (
                    <option key={ct.id} value={ct.slug}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Area / Locality *
                </label>
                <input
                  type="text"
                  list="locality-suggestions"
                  value={formData.locality || ''}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    updateField('locality', selectedVal);
                    const loc = locationRepository.getLocalityBySlugOrName(selectedVal, formData.city_slug);
                    if (loc) {
                      updateField('locality_slug', loc.slug);
                      updateField('latitude', loc.latitude);
                      updateField('longitude', loc.longitude);
                      setIsLocationConfirmed(false);
                    } else {
                      updateField('locality_slug', selectedVal.toLowerCase().replace(/\s+/g, '-'));
                      setIsLocationConfirmed(false);
                    }
                  }}
                  placeholder="e.g. Andheri West, Koramangala, Sector 62, Katra..."
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                />
                <datalist id="locality-suggestions">
                  {locationRepository.getLocalities(formData.city_slug).map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}{loc.hindi_name ? ` (${loc.hindi_name})` : ''}
                    </option>
                  ))}
                </datalist>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Type your area or pick from suggestions. Custom localities are supported.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Nearest College, Metro, or Coaching Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={formData.landmark || ''}
                  onChange={(e) => updateField('landmark', e.target.value)}
                  placeholder="e.g. 200m to Metro Gate, Behind Coaching Complex"
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={formData.pincode || ''}
                  onChange={(e) => updateField('pincode', e.target.value)}
                  placeholder="e.g. 211002, 110092, 400053"
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Address Line / House Number
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="e.g. Flat 302, Building A, Main Road"
                className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">
                🔒 Note: Exact house address and doorstep coordinates are kept private. The public map shows only approximate neighborhood pins.
              </p>
            </div>

            {/* Interactive Location Confirmation & Map Pin Adjustment */}
            <div className="border border-[#E2E8F0] rounded-2xl p-4 bg-white space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-[#101828] font-heading flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#F59E0B]" />
                    <span>Is this your property location?</span>
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Drag the pin or click on the map to pinpoint your exact gate/doorstep for accurate walking distance.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isLocationConfirmed ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#101828] text-[#F59E0B] border border-[#F59E0B]/30 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-[#F59E0B]" />
                      <span>Location Confirmed</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsLocationConfirmed(true)}
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      className="text-xs font-bold"
                    >
                      Confirm Location
                    </Button>
                  )}
                </div>
              </div>

              {/* Map Preview */}
              <LocationPickerMap
                latitude={
                  formData.latitude ??
                  locationRepository.getCityBySlugOrName(formData.city_slug || '')?.latitude ??
                  20.5937
                }
                longitude={
                  formData.longitude ??
                  locationRepository.getCityBySlugOrName(formData.city_slug || '')?.longitude ??
                  78.9629
                }
                localityName={formData.locality}
                onLocationChange={async (lat, lng) => {
                  updateField('latitude', lat);
                  updateField('longitude', lng);
                  setAccuracyLabel('Location set manually');
                  setIsLocationConfirmed(false);
                  setLocationMethod('map');

                  try {
                    const rev = await locationRepository.reverseGeocodeAsync(lat, lng);
                    if (rev.city) updateField('city', rev.city);
                    if (rev.citySlug) updateField('city_slug', rev.citySlug);
                    if (rev.state) updateField('state', rev.state);
                    if (rev.stateCode) updateField('state_code', rev.stateCode);
                    if (rev.locality) {
                      updateField('locality', rev.locality);
                      updateField('locality_slug', rev.localitySlug || rev.locality.toLowerCase().replace(/\s+/g, '-'));
                    }
                    if (rev.landmark) updateField('landmark', `Near ${rev.landmark}`);
                  } catch {
                    // Ignore reverse geocode failure
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 3: PRICING */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Monthly Rent (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-[#94A3B8] font-bold">₹</span>
                  <input
                    type="number"
                    value={formData.rent}
                    onChange={(e) => updateField('rent', Number(e.target.value))}
                    className="w-full p-3.5 pl-8 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#101828]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Security Deposit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-[#94A3B8] font-bold">₹</span>
                  <input
                    type="number"
                    value={formData.security_deposit}
                    onChange={(e) => updateField('security_deposit', Number(e.target.value))}
                    className="w-full p-3.5 pl-8 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#101828]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Electricity Billing Rule
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('electricity_billing', 'included')}
                  className={`p-3.5 rounded-xl border text-left text-xs ${
                    formData.electricity_billing === 'included'
                      ? 'border-[#101828] bg-[#F8FAFC] font-bold'
                      : 'border-[#E5E7EB]'
                  }`}
                >
                  <div>Electricity Included</div>
                  <div className="text-[10px] text-[#667085]">No extra bill charges</div>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('electricity_billing', 'per_meter')}
                  className={`p-3.5 rounded-xl border text-left text-xs ${
                    formData.electricity_billing === 'per_meter'
                      ? 'border-[#101828] bg-[#F8FAFC] font-bold'
                      : 'border-[#E5E7EB]'
                  }`}
                >
                  <div>As per Sub-Meter</div>
                  <div className="text-[10px] text-[#667085]">₹9/unit charged monthly</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Number of Available Vacancies / Beds
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={formData.vacancies}
                onChange={(e) => updateField('vacancies', Number(e.target.value))}
                className="w-full p-3.5 rounded-xl border border-[#E5E7EB] text-sm font-medium"
              />
            </div>
          </div>
        )}

        {/* STEP 4: ROOM SPECS & AMENITIES */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Room Sharing Type
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'single', label: 'Single Occupancy' },
                  { id: 'double', label: 'Double Sharing' },
                  { id: 'triple', label: 'Triple Sharing' },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => updateField('room_type', r.id)}
                    className={`p-3 rounded-xl border text-xs font-bold text-center ${
                      formData.room_type === r.id
                        ? 'bg-[#101828] text-white border-[#101828]'
                        : 'bg-[#F8FAFC] border-[#E5E7EB] text-[#475569]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Attached Bathroom?
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => updateField('attached_bathroom', true)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center ${
                    formData.attached_bathroom
                      ? 'bg-[#101828] text-white border-[#101828]'
                      : 'bg-[#F8FAFC] border-[#E5E7EB]'
                  }`}
                >
                  Yes, Attached Bathroom
                </button>
                <button
                  type="button"
                  onClick={() => updateField('attached_bathroom', false)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center ${
                    !formData.attached_bathroom
                      ? 'bg-[#101828] text-white border-[#101828]'
                      : 'bg-[#F8FAFC] border-[#E5E7EB]'
                  }`}
                >
                  Common Clean Bathroom
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                Select Amenities Included
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AMENITIES_CATALOG.map((a) => {
                  const isChecked = (formData.amenities || []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleAmenityToggle(a.id)}
                      className={`p-3 rounded-xl border text-xs text-left flex items-center justify-between ${
                        isChecked
                          ? 'border-[#101828] bg-[#F8FAFC] font-semibold text-[#101828]'
                          : 'border-[#E5E7EB] text-[#64748B]'
                      }`}
                    >
                      <span>{a.name}</span>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-[#F59E0B]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: RULES */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
                House &amp; Gate Rules
              </label>
              <div className="space-y-2">
                {RULES_CATALOG.map((rule) => {
                  const isChecked = (formData.rules || []).includes(rule.id);
                  return (
                    <label
                      key={rule.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer ${
                        isChecked
                          ? 'border-[#101828] bg-[#F8FAFC]'
                          : 'border-[#E5E7EB] hover:bg-[#FAFAFA]'
                      }`}
                    >
                      <span className="text-xs font-medium text-[#111827]">{rule.name}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleRuleToggle(rule.id)}
                        className="w-4 h-4 text-[#101828] focus:ring-[#101828] rounded"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: PHOTOS */}
        {currentStep === 6 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Add Photo URL / Image Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Paste direct image URL (or use default student room photo)..."
                  className="flex-1 p-3 rounded-xl border border-[#E5E7EB] text-xs"
                />
                <Button variant="primary" size="md" onClick={handleAddImage}>
                  Add Image
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(formData.images || []).map((img, idx) => (
                <div
                  key={img.id}
                  className="relative rounded-xl overflow-hidden border border-[#E5E7EB] group h-36 bg-[#F8FAFC]"
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-full hover:bg-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {img.is_cover && (
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-[#101828] text-white px-1.5 py-0.5 rounded font-bold">
                      Cover Photo
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: PRIVACY & PREVIEW */}
        {currentStep === 7 && (
          <div className="space-y-6">
            {/* Phone Privacy Selector */}
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#101828]">
                Phone Number Visibility Setting
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'private',
                    label: 'Private by Default (Recommended)',
                    desc: 'Your phone number is hidden. Students connect via in-app chat first.',
                  },
                  {
                    id: 'on_request',
                    label: 'On Request (Mutual Exchange)',
                    desc: 'Your phone number is unlocked only when you accept a contact request.',
                  },
                  {
                    id: 'public',
                    label: 'Publicly Visible',
                    desc: 'Students can directly see and call your phone number immediately.',
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
                      formData.phone_privacy === opt.id
                        ? 'border-[#101828] bg-white font-medium'
                        : 'border-[#E5E7EB]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="phone_privacy_add"
                      checked={formData.phone_privacy === opt.id}
                      onChange={() => updateField('phone_privacy', opt.id)}
                      className="mt-0.5 text-[#101828] focus:ring-[#101828]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#111827]">{opt.label}</div>
                      <div className="text-[11px] text-[#667085]">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Live Student Preview */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="text-sm font-bold text-[#101828] font-heading">
                  How Students Will See Your Property in Search
                </h3>
              </div>
              <div className="max-w-sm mx-auto sm:mx-0">
                <PropertyCard
                  property={previewProperty}
                  onSelect={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="pt-6 border-t border-[#F1F5F9] flex items-center justify-between">
          {currentStep > 1 ? (
            <Button
              variant="outline"
              size="md"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              disabled={currentStep === 1 && !formData.title?.trim()}
            >
              Next Step
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={handlePublish}
              loading={isSubmitting}
              icon={<CheckCircle2 className="w-5 h-5" />}
              className="font-bold"
            >
              Publish Listing Now
            </Button>
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
};

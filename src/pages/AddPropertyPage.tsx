import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Navigation,
  Loader2,
  AlertCircle,
  Phone,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { locationService } from '../services/location/locationService';
import { Button } from '../components/common/Button';
import { PropertyCard } from '../components/property/PropertyCard';
import { Property, PropertyType, GenderPreference, RoomType, PhonePrivacy, PropertyImage } from '../types';
import { locationRepository } from '../services/locationRepository';
import { evaluateLocationAccuracy } from '../services/location/locationAccuracy';
import { getSupportedCities, getCityConfig, getCityAreas } from '../data/cityAreas';
import { lookupIndianPincode } from '../services/pincodeService';
import { AMENITIES_CATALOG, RULES_CATALOG } from '../config/brand';
import { propertyRepository } from '../services/propertyRepository';
import { uploadPropertyImage, deletePropertyImage } from '../utils/imageUpload';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LocationPickerMap } from '../components/map/LocationPickerMap';
import { isValidIndianPhoneNumber } from '../utils/phoneUtils';

interface AddPropertyPageProps {
  onSuccess: (newProperty: Property) => void;
  onCancel: () => void;
}

const DRAFT_STORAGE_KEY = 'rented_thikan_owner_draft_v1';

export const AddPropertyPage: React.FC<AddPropertyPageProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { currentUser, updateProfile } = useAuth();
  const { userLocation } = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  // Form State initialized with draft if present
  const [formData, setFormData] = useState<Partial<Property>>(() => {
    try {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) return JSON.parse(draft);
    } catch {
      // Ignore corrupted local storage
    }
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
      show_phone_number: false, // Default private by specification
      phone_number: currentUser?.phone_number || '',
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

  // Automatically sync profile phone into formData once auth loads if form field is empty
  useEffect(() => {
    if (currentUser?.phone_number && !formData.phone_number) {
      setFormData((prev) => ({
        ...prev,
        phone_number: currentUser.phone_number,
        owner_phone: currentUser.phone_number,
      }));
    }
  }, [currentUser?.phone_number]);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo Upload States & Refs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgressMessage, setUploadProgressMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Lister Location Intelligence & GPS State
  const [isGpsDetecting, setIsGpsDetecting] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const [isLocationDetected, setIsLocationDetected] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [accuracyLabel, setAccuracyLabel] = useState<string>('Location set manually');
  const [searchLocationQuery, setSearchLocationQuery] = useState('');
  const [isManualAreaEntry, setIsManualAreaEntry] = useState(false);
  const [pincodePostOffices, setPincodePostOffices] = useState<string[]>([]);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const handleStepChange = (newStep: number) => {
    setCurrentStep(newStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyDetectedLocation = (loc: {
    country?: string;
    state?: string;
    stateCode?: string;
    city?: string;
    citySlug?: string;
    locality?: string;
    localitySlug?: string;
    formattedAddress?: string;
    pincode?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }) => {
    if (!loc.latitude || !loc.longitude) return;

    const citySlug = loc.citySlug || 'prayagraj';
    const cityAreas = getCityAreas(citySlug);
    const locName = (loc.locality || '').trim();
    const locLower = locName.toLowerCase();

    // Check exact or partial match in verified city areas
    let matchedArea = cityAreas.find((a) => a.toLowerCase().trim() === locLower);
    if (!matchedArea) {
      matchedArea = cityAreas.find((a) => {
        const aLower = a.toLowerCase();
        return locLower.includes(aLower) || aLower.includes(detLower(locLower));
      });
    }

    if (!matchedArea && locName) {
      setIsManualAreaEntry(true);
    } else if (matchedArea) {
      setIsManualAreaEntry(false);
    }

    const finalLocality = matchedArea || locName;
    const finalLocalitySlug = finalLocality.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    setFormData((prev) => ({
      ...prev,
      country: loc.country || 'India',
      address: loc.formattedAddress || prev.address,
      pincode: loc.pincode || prev.pincode,
      state: loc.state || prev.state || 'Uttar Pradesh',
      state_code: loc.stateCode || prev.state_code || 'UP',
      city: loc.city || prev.city || 'Prayagraj',
      city_slug: citySlug,
      locality: finalLocality || prev.locality,
      locality_slug: finalLocalitySlug || prev.locality_slug,
      landmark: loc.landmark ? (loc.landmark.startsWith('Near') ? loc.landmark : `Near ${loc.landmark}`) : prev.landmark,
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));

    setIsLocationDetected(true);
    if (loc.accuracy) {
      setAccuracyLabel(`GPS accuracy: ±${Math.round(loc.accuracy)} m`);
    } else {
      setAccuracyLabel('Applied from phone GPS');
    }
  };

  const detLower = (val: string) => val.trim().toLowerCase();

  const handleUseCurrentGps = async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported on this device or browser. Please enter your location manually.');
      return;
    }

    setIsGpsDetecting(true);
    setGpsStatusMessage('📍 Detecting your location...');
    setGpsError(null);

    const startTime = Date.now();
    try {
      const detected = await locationService.detectLocation(undefined, true);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      applyDetectedLocation({
        country: detected.country,
        state: detected.state,
        stateCode: detected.stateCode,
        city: detected.city,
        citySlug: detected.citySlug,
        locality: detected.locality,
        localitySlug: detected.localitySlug,
        formattedAddress: detected.formattedAddress,
        pincode: detected.pincode,
        landmark: detected.landmark,
        latitude: detected.latitude,
        longitude: detected.longitude,
        accuracy: detected.accuracy,
      });

      setIsGpsDetecting(false);
      setGpsStatusMessage(`✓ Location detected in ${elapsed}s`);

      if (detected.isLowAccuracy) {
        setGpsError(`Low accuracy fix (±${Math.round(detected.accuracy)}m). Please verify your exact locality below.`);
      } else {
        setGpsError(null);
      }
    } catch (err: any) {
      setIsGpsDetecting(false);
      setGpsStatusMessage(null);
      if (err.code === 1) {
        setGpsError('Location permission was denied. Please enter your location manually.');
      } else {
        setGpsError("We couldn't detect your location. Please enter your location manually.");
      }
    }
  };

  // Auto-populate location fields in Step 2 if GPS location was already detected in session
  useEffect(() => {
    if (
      currentStep === 2 &&
      userLocation.latitude &&
      userLocation.longitude &&
      userLocation.source === 'gps' &&
      !formData.latitude
    ) {
      applyDetectedLocation({
        country: userLocation.country,
        state: userLocation.state,
        stateCode: userLocation.stateCode,
        city: userLocation.city,
        citySlug: userLocation.citySlug,
        locality: userLocation.locality,
        localitySlug: userLocation.localitySlug,
        formattedAddress: userLocation.displayName,
        pincode: userLocation.pincode,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy,
      });
    }
  }, [currentStep, userLocation, formData.latitude]);

  // Auto-save draft on form changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } catch {
      // Storage quota or private browsing restriction
    }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = e.currentTarget;
    const files = inputElement.files ? Array.from(inputElement.files) : [];
    if (files.length === 0) return;

    // Reset input value immediately so re-selecting the same file reliably fires onChange
    inputElement.value = '';

    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setUploadError('Please select valid image files.');
      return;
    }

    setIsUploadingPhoto(true);
    setUploadError(null);
    setUploadProgressMessage(`Preparing ${validFiles.length} photo${validFiles.length > 1 ? 's' : ''}...`);

    try {
      const newImages: PropertyImage[] = [];

      // Process sequentially to protect mobile RAM and avoid freezing UI
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgressMessage(`Optimizing photo ${i + 1} of ${validFiles.length}...`);

        const uploadResult = await uploadPropertyImage(file, currentUser?.id, (status) => {
          setUploadProgressMessage(`Photo ${i + 1}/${validFiles.length}: ${status}`);
        });

        const existingCount = (formData.images || []).length + newImages.length;
        newImages.push({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          url: uploadResult.url,
          thumbnail_url: uploadResult.thumbnailUrl,
          caption: `Photo ${existingCount + 1}`,
          is_cover: existingCount === 0,
        });
      }

      if (newImages.length > 0) {
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), ...newImages],
        }));
      }
    } catch (err: any) {
      console.error('Failed to process image:', err);
      setUploadError(err.message || 'Failed to process one or more images. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgressMessage(null);
    }
  };

  const handleSetCover = (imgId: string) => {
    const next = (formData.images || []).map((img) => ({
      ...img,
      is_cover: img.id === imgId,
    }));
    updateField('images', next);
  };

  const handleAddImage = () => {
    if (!imageUrlInput.trim()) return;
    const newImg: PropertyImage = {
      id: `img-${Date.now()}`,
      url: imageUrlInput.trim(),
      caption: 'Room Photo',
      is_cover: (formData.images || []).length === 0,
    };
    updateField('images', [...(formData.images || []), newImg]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (imgId: string) => {
    const target = (formData.images || []).find((i) => i.id === imgId);
    if (target?.url && target.url.includes('/property-images/')) {
      deletePropertyImage(target.url).catch(() => {});
    }

    const next = (formData.images || []).filter((i) => i.id !== imgId);
    if (next.length > 0 && !next.some((i) => i.is_cover)) {
      next[0].is_cover = true;
    }
    updateField('images', next);
  };

  const handlePublish = async () => {
    if (!formData.locality?.trim()) {
      alert("Please enter your property's area/locality before publishing.");
      handleStepChange(2);
      return;
    }
    if (!formData.city?.trim()) {
      alert("Please select a city before publishing.");
      handleStepChange(2);
      return;
    }
    if (!formData.state?.trim()) {
      alert("Please select a state before publishing.");
      handleStepChange(2);
      return;
    }

    if (formData.show_phone_number) {
      if (!formData.phone_number || !isValidIndianPhoneNumber(formData.phone_number)) {
        alert("Please enter a valid 10-digit Indian mobile number to enable direct phone calls and WhatsApp, or choose 'No (Keep Private)'.");
        handleStepChange(7);
        return;
      }
    }

    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const isPublic = Boolean(formData.show_phone_number);
      const cleanPhone = formData.phone_number?.trim() || null;

      // Proactively persist phone to profile if user provided one
      if (cleanPhone && cleanPhone !== currentUser.phone_number) {
        try {
          await updateProfile({
            phone_number: cleanPhone,
            phone_privacy: isPublic ? 'public' : 'private',
          });
        } catch (profileErr) {
          console.warn('Could not update profile with phone:', profileErr);
        }
      }

      const created = await propertyRepository.createProperty({
        ...formData,
        phone_number: cleanPhone,
        show_phone_number: isPublic,
        phone_privacy: isPublic ? 'public' : 'private',
        owner_id: currentUser.id,
        owner_name: currentUser.full_name,
        created_by: currentUser.id,
        lister_name: currentUser.full_name,
        lister_phone: isPublic ? cleanPhone : null,
        owner_phone: isPublic ? cleanPhone : null,
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
  const isPreviewPhoneVisible = Boolean(formData.show_phone_number);
  const previewPhone = isPreviewPhoneVisible ? formData.phone_number : null;

  const previewProperty: Property = {
    id: 'preview-sample',
    owner_id: currentUser?.id || 'pending',
    owner_name: currentUser?.full_name || 'Owner',
    phone_number: previewPhone,
    show_phone_number: isPreviewPhoneVisible,
    owner_phone: previewPhone,
    created_by: currentUser?.id || 'pending',
    lister_name: currentUser?.full_name || 'Owner',
    lister_phone: previewPhone,
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
    phone_privacy: isPreviewPhoneVisible ? 'public' : 'private',
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
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28">
        {/* Wizard Progress Header */}
        <div className="mb-4 sm:mb-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Step {currentStep} of {totalSteps}
              </span>
              <h1 className="text-base sm:text-xl font-bold text-[#101828] font-heading mt-1">
                {currentStep === 1 && 'Basic Property Information'}
                {currentStep === 2 && `Location & Landmarks in ${formData.city || 'Prayagraj'}`}
                {currentStep === 3 && 'Rent, Deposit & Billing'}
                {currentStep === 4 && 'Room Specs & Amenities'}
                {currentStep === 5 && 'House & Gate Rules'}
                {currentStep === 6 && 'Photos & Cover Image'}
                {currentStep === 7 && 'Direct Contact, Phone Privacy & Publish'}
              </h1>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[#667085] hover:text-[#101828] font-semibold py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#101828] h-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Step Container */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E5E7EB] p-4 sm:p-6 shadow-xs space-y-4">
          {/* STEP 1: BASICS */}
          {currentStep === 1 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                    Property Name / Title *
                  </label>
                  <span className="text-[10px] text-[#94A3B8]">Required</span>
                </div>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. Sunrise Student PG & Co-Living or Modern 2BHK Flat"
                  className="w-full p-2.5 sm:p-3 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-xs sm:text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  Property Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { id: 'pg', label: 'Student PG' },
                    { id: 'hostel', label: 'Hostel' },
                    { id: 'room', label: 'Single Room' },
                    { id: 'flat', label: 'Flat / 2BHK' },
                    { id: 'shared_room', label: 'Shared Bed' },
                    { id: 'homestay', label: 'Homestay' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => updateField('property_type', type.id)}
                      className={`py-2 px-1.5 sm:px-2 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                        formData.property_type === type.id
                          ? 'border-[#101828] bg-[#101828] text-white shadow-xs'
                          : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#334155] hover:bg-slate-100'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  Gender Suitability
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { id: 'male', label: 'Boys Only' },
                    { id: 'female', label: 'Girls Only' },
                    { id: 'any', label: 'Co-ed / Any' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => updateField('gender_preference', g.id)}
                      className={`py-2 px-2 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer ${
                        formData.gender_preference === g.id
                          ? 'bg-[#101828] text-white border-[#101828] shadow-xs'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E5E7EB] hover:bg-slate-100'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Short Description for Students (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Mention highlights: silent study atmosphere, nearby library, healthy mess food, distance to campus..."
                  className="w-full p-2.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-xs resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2: LOCATION */}
          {currentStep === 2 && (
            <div className="space-y-3.5 sm:space-y-4">
              {/* Quick GPS Capture Card (Compact 1-Tap Bar) */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/30">
                    <Navigation className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-white truncate">
                      {isGpsDetecting ? (gpsStatusMessage || 'Detecting satellite GPS...') : 'Standing at the property now?'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Auto-locks exact doorstep walking coordinates
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUseCurrentGps}
                  disabled={isGpsDetecting}
                  className="px-3 py-1.5 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {isGpsDetecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5" />
                      <span>📍 Auto-fill GPS</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ready GPS from LocationProvider banner if available */}
              {userLocation.latitude && userLocation.source === 'gps' && (!formData.latitude || formData.latitude !== userLocation.latitude) && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 min-w-0">
                    <Navigation className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Ready GPS: <strong className="text-slate-900">{userLocation.locality || userLocation.city}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyDetectedLocation({
                      country: userLocation.country,
                      state: userLocation.state,
                      stateCode: userLocation.stateCode,
                      city: userLocation.city,
                      citySlug: userLocation.citySlug,
                      locality: userLocation.locality,
                      localitySlug: userLocation.localitySlug,
                      formattedAddress: userLocation.displayName,
                      pincode: userLocation.pincode,
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                    })}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shrink-0 transition text-[11px] cursor-pointer shadow-xs"
                  >
                    1-Tap Auto-fill
                  </button>
                </div>
              )}

              {gpsError && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{gpsError}</span>
                </div>
              )}

              {/* City & Predefined / Manual Area Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    City *
                  </label>
                  <select
                    value={formData.city_slug || 'prayagraj'}
                    onChange={(e) => {
                      const selectedSlug = e.target.value;
                      const cfg = getCityConfig(selectedSlug);
                      if (cfg) {
                        updateField('city', cfg.name);
                        updateField('city_slug', cfg.slug);
                        updateField('state', cfg.state);
                        updateField('state_code', cfg.stateCode);
                        if (!formData.latitude || !formData.longitude) {
                          updateField('latitude', cfg.defaultLat);
                          updateField('longitude', cfg.defaultLon);
                        }
                        const newCityAreas = cfg.areas;
                        if (!newCityAreas.includes(formData.locality || '')) {
                          updateField('locality', '');
                          updateField('locality_slug', '');
                        }
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-xs sm:text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                  >
                    {getSupportedCities().map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name} ({c.state})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                      Area / Locality *
                    </label>
                    {!isManualAreaEntry ? (
                      <button
                        type="button"
                        onClick={() => setIsManualAreaEntry(true)}
                        className="text-[11px] text-[#D97706] hover:underline font-semibold cursor-pointer"
                      >
                        ✏️ Type manually
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsManualAreaEntry(false)}
                        className="text-[11px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
                      >
                        ← Choose from list
                      </button>
                    )}
                  </div>

                  {!isManualAreaEntry ? (
                    <select
                      value={formData.locality || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__manual__') {
                          setIsManualAreaEntry(true);
                          return;
                        }
                        updateField('locality', val);
                        updateField('locality_slug', val.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                        if (!formData.latitude || !formData.longitude) {
                          const cfg = getCityConfig(formData.city_slug);
                          if (cfg) {
                            updateField('latitude', cfg.defaultLat);
                            updateField('longitude', cfg.defaultLon);
                          }
                        }
                      }}
                      className="w-full p-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-xs sm:text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                    >
                      <option value="">-- Select Area in {formData.city || 'Prayagraj'} --</option>
                      {getCityAreas(formData.city_slug || 'prayagraj').map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                      <option value="__manual__">+ Can't find area? Type manually...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.locality || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateField('locality', val);
                        updateField('locality_slug', val.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                        if (!formData.latitude || !formData.longitude) {
                          const cfg = getCityConfig(formData.city_slug);
                          if (cfg) {
                            updateField('latitude', cfg.defaultLat);
                            updateField('longitude', cfg.defaultLon);
                          }
                        }
                      }}
                      placeholder="e.g. Civil Lines, Katra, Salori..."
                      className="w-full p-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-xs sm:text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                    />
                  )}
                </div>
              </div>

              {/* Landmarks & Pincode in 2-col inline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Nearest Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.landmark || ''}
                    onChange={(e) => updateField('landmark', e.target.value)}
                    placeholder="e.g. Near University Library, Metro Gate"
                    className="w-full p-2.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={formData.pincode || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('pincode', val);
                      const clean = val.trim();
                      if (clean.length === 6 && /^[1-9][0-9]{5}$/.test(clean)) {
                        lookupIndianPincode(clean).then((res) => {
                          setPincodePostOffices(res?.postOffices || []);
                        });
                      } else if (pincodePostOffices.length > 0) {
                        setPincodePostOffices([]);
                      }
                    }}
                    placeholder="e.g. 211002"
                    className="w-full p-2.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-xs sm:text-sm"
                  />
                  {pincodePostOffices.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-[#64748B]">Areas:</span>
                      {pincodePostOffices.slice(0, 3).map((po) => (
                        <button
                          key={po}
                          type="button"
                          onClick={() => {
                            updateField('locality', po);
                            updateField('locality_slug', po.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                          }}
                          className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                        >
                          + {po}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Address Line */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                  House / Building Address Line
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="e.g. Flat 302, Building A, Main Road (Kept private for safety)"
                  className="w-full p-2.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-xs sm:text-sm"
                />
              </div>

              {/* Doorstep GPS Map Preview Toggle */}
              {formData.latitude && formData.longitude && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>GPS Attached ({Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMapPreview(!showMapPreview)}
                      className="text-[#D97706] hover:text-[#B45309] font-bold cursor-pointer text-[11px] hover:underline"
                    >
                      {showMapPreview ? '▲ Hide Map Pin' : '▼ Adjust Map Pin'}
                    </button>
                  </div>

                  {showMapPreview && (
                    <div className="rounded-xl overflow-hidden border border-[#E5E7EB] shadow-xs">
                      <LocationPickerMap
                        latitude={Number(formData.latitude)}
                        longitude={Number(formData.longitude)}
                        localityName={formData.locality || formData.city}
                        onLocationChange={(newLat, newLng) => {
                          updateField('latitude', newLat);
                          updateField('longitude', newLng);
                        }}
                        className="h-44 sm:h-56 w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PRICING */}
          {currentStep === 3 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Monthly Rent (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 sm:top-3 text-[#94A3B8] font-bold text-xs sm:text-sm">₹</span>
                    <input
                      type="number"
                      value={formData.rent}
                      onChange={(e) => updateField('rent', Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 pl-7 rounded-xl border border-[#E5E7EB] text-xs sm:text-sm font-bold text-[#101828]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Security Deposit (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 sm:top-3 text-[#94A3B8] font-bold text-xs sm:text-sm">₹</span>
                    <input
                      type="number"
                      value={formData.security_deposit}
                      onChange={(e) => updateField('security_deposit', Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 pl-7 rounded-xl border border-[#E5E7EB] text-xs sm:text-sm font-bold text-[#101828]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  Electricity Billing Rule
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => updateField('electricity_billing', 'included')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.electricity_billing === 'included'
                        ? 'border-[#101828] bg-[#F8FAFC] font-bold'
                        : 'border-[#E5E7EB] hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#101828]">Electricity Included</div>
                    <div className="text-[10px] text-[#667085]">No extra bill charges</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('electricity_billing', 'per_meter')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.electricity_billing === 'per_meter'
                        ? 'border-[#101828] bg-[#F8FAFC] font-bold'
                        : 'border-[#E5E7EB] hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#101828]">Sub-Meter Bill</div>
                    <div className="text-[10px] text-[#667085]">₹9/unit charged monthly</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Number of Available Vacancies / Beds
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.vacancies}
                  onChange={(e) => updateField('vacancies', Number(e.target.value))}
                  className="w-full p-2.5 sm:p-3 rounded-xl border border-[#E5E7EB] text-xs sm:text-sm font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 4: ROOM SPECS & AMENITIES */}
          {currentStep === 4 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  Room Sharing Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { id: 'single', label: 'Single Room' },
                    { id: 'double', label: 'Double Sharing' },
                    { id: 'triple', label: 'Triple Sharing' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => updateField('room_type', r.id)}
                      className={`py-2 px-1.5 sm:px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        formData.room_type === r.id
                          ? 'bg-[#101828] text-white border-[#101828] shadow-xs'
                          : 'bg-[#F8FAFC] border-[#E5E7EB] text-[#475569] hover:bg-slate-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  Attached Bathroom?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('attached_bathroom', true)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      formData.attached_bathroom
                        ? 'bg-[#101828] text-white border-[#101828] shadow-xs'
                        : 'bg-[#F8FAFC] border-[#E5E7EB] text-[#475569] hover:bg-slate-100'
                    }`}
                  >
                    Yes, Attached Bathroom
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('attached_bathroom', false)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      !formData.attached_bathroom
                        ? 'bg-[#101828] text-white border-[#101828] shadow-xs'
                        : 'bg-[#F8FAFC] border-[#E5E7EB] text-[#475569] hover:bg-slate-100'
                    }`}
                  >
                    Common Clean Bathroom
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  Select Amenities Included
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {AMENITIES_CATALOG.map((a) => {
                    const isChecked = (formData.amenities || []).includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleAmenityToggle(a.id)}
                        className={`py-2 px-2.5 rounded-xl border text-xs text-left flex items-center justify-between transition-all cursor-pointer ${
                          isChecked
                            ? 'border-[#101828] bg-[#101828] text-white font-bold shadow-xs'
                            : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#475569] hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{a.name}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: RULES */}
          {currentStep === 5 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                  House &amp; Gate Rules
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                  {RULES_CATALOG.map((rule) => {
                    const isChecked = (formData.rules || []).includes(rule.id);
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => handleRuleToggle(rule.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isChecked
                            ? 'border-[#101828] bg-[#F8FAFC] font-bold text-[#101828]'
                            : 'border-[#E5E7EB] bg-white text-[#475569] hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs">{rule.name}</span>
                        <input
                          type="checkbox"
                          readOnly
                          checked={isChecked}
                          className="w-4 h-4 text-[#101828] rounded pointer-events-none"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PHOTOS */}
          {currentStep === 6 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs sm:text-sm font-bold text-[#101828] flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#F59E0B]" />
                    <span>Property Photos</span>
                  </h3>
                  <span className="text-[11px] text-[#667085]">
                    {formData.images?.length || 0} photo(s) added
                  </span>
                </div>
                <p className="text-[11px] text-[#667085]">
                  Upload clear photos of room, bed, bathroom, and building entrance.
                </p>
              </div>

              {/* Dual Action Native Inputs: Gallery + Camera */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* 1. Choose from Gallery */}
                <label
                  className={`relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3 p-3 rounded-xl border-2 border-dashed border-[#CBD5E1] hover:border-[#101828] bg-[#F8FAFC] hover:bg-white text-[#101828] transition-all shadow-xs active:scale-98 cursor-pointer select-none ${
                    isUploadingPhoto ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingPhoto}
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    aria-label="Choose from Gallery"
                  />
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-[#D97706] flex items-center justify-center shrink-0 pointer-events-none">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="pointer-events-none min-w-0">
                    <p className="font-bold text-xs text-[#101828] truncate">From Gallery</p>
                    <p className="text-[10px] text-[#667085] hidden sm:block">Select photos</p>
                  </div>
                </label>

                {/* 2. Take Photo with Camera */}
                <label
                  className={`relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3 p-3 rounded-xl border-2 border-dashed border-[#CBD5E1] hover:border-[#101828] bg-[#F8FAFC] hover:bg-white text-[#101828] transition-all shadow-xs active:scale-98 cursor-pointer select-none ${
                    isUploadingPhoto ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isUploadingPhoto}
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    aria-label="Take Photo with Camera"
                  />
                  <div className="w-8 h-8 rounded-lg bg-[#101828] text-[#F59E0B] flex items-center justify-center shrink-0 pointer-events-none">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="pointer-events-none min-w-0">
                    <p className="font-bold text-xs text-[#101828] truncate">Take Photo</p>
                    <p className="text-[10px] text-[#667085] hidden sm:block">With Camera</p>
                  </div>
                </label>
              </div>

              {isUploadingPhoto && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F59E0B] shrink-0" />
                  <span>{uploadProgressMessage || 'Saving photos...'}</span>
                </div>
              )}

              {uploadError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Optional URL input fallback */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[11px] font-semibold text-[#667085] hover:text-[#101828] underline cursor-pointer"
                >
                  {showUrlInput ? 'Hide image URL input' : '+ Or paste a direct image URL'}
                </button>
                {showUrlInput && (
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Paste direct image URL..."
                      className="flex-1 p-2 rounded-xl border border-[#E5E7EB] text-xs"
                    />
                    <Button variant="primary" size="sm" onClick={handleAddImage} className="text-xs">
                      Add URL
                    </Button>
                  </div>
                )}
              </div>

              {/* Selected Photos Thumbnails Grid */}
              {(formData.images || []).length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {(formData.images || []).map((img) => (
                    <div
                      key={img.id}
                      className="relative rounded-xl overflow-hidden border border-[#E5E7EB] group aspect-4/3 bg-[#F8FAFC] shadow-xs"
                    >
                      <img src={img.thumbnail_url || img.url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {img.is_cover ? (
                        <span className="absolute bottom-1 left-1 text-[9px] bg-[#101828] text-[#F59E0B] px-1.5 py-0.5 rounded font-bold">
                          Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetCover(img.id)}
                          className="absolute bottom-1 left-1 text-[9px] bg-black/70 hover:bg-[#101828] text-white px-1.5 py-0.5 rounded font-semibold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          Set Cover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 7: DIRECT CONTACT, PRIVACY & PREVIEW */}
          {currentStep === 7 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#101828] font-heading flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#F59E0B]" />
                  <span>Contact Information & Phone Visibility</span>
                </h3>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  Decide whether students can call & WhatsApp you directly, or only message through the website.
                </p>
              </div>

              {/* Direct Phone Number Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#101828] mb-1">
                  Host Mobile Number (Optional / For Direct Contact)
                </label>
                <div className="flex items-center rounded-xl border border-[#CBD5E1] bg-white overflow-hidden focus-within:border-[#F59E0B] focus-within:ring-2 focus-within:ring-[#F59E0B]/20 transition-all">
                  <span className="px-2.5 py-2 bg-slate-100 text-xs font-bold text-slate-700 border-r border-[#CBD5E1] select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formData.phone_number || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      updateField('phone_number', val);
                      updateField('owner_phone', val);
                    }}
                    placeholder="Enter 10-digit mobile number"
                    className="flex-1 px-2.5 py-2 text-xs text-[#101828] placeholder:text-[#94A3B8] focus:outline-none font-medium"
                  />
                </div>
                {formData.phone_number && !isValidIndianPhoneNumber(formData.phone_number) && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Please enter a valid 10-digit Indian mobile number.
                  </p>
                )}
              </div>

              {/* Show Phone Number to other users? (Yes / No) */}
              <div className="pt-2 border-t border-[#F1F5F9] space-y-2">
                <label className="block text-[11px] font-bold text-[#101828]">
                  Show phone number to other users?
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option NO: Keep Private (Default) */}
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      !formData.show_phone_number
                        ? 'border-[#101828] bg-[#F8FAFC] shadow-xs'
                        : 'border-[#E5E7EB] hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="show_phone_number_choice"
                      checked={!formData.show_phone_number}
                      onChange={() => {
                        updateField('show_phone_number', false);
                        updateField('phone_privacy', 'private');
                      }}
                      className="mt-0.5 text-[#101828] focus:ring-[#101828]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#111827] flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span>No (Keep Private - Default)</span>
                      </div>
                      <div className="text-[10px] text-[#667085] mt-0.5">
                        Phone hidden. Students contact you via in-app messages.
                      </div>
                    </div>
                  </label>

                  {/* Option YES: Show Phone */}
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      formData.show_phone_number
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                        : 'border-[#E5E7EB] hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="show_phone_number_choice"
                      checked={Boolean(formData.show_phone_number)}
                      onChange={() => {
                        updateField('show_phone_number', true);
                        updateField('phone_privacy', 'public');
                      }}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#111827] flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>Yes (Show Phone Number)</span>
                      </div>
                      <div className="text-[10px] text-[#667085] mt-0.5">
                        Students can call & WhatsApp you directly.
                      </div>
                    </div>
                  </label>
                </div>

                {formData.show_phone_number && (!formData.phone_number || !isValidIndianPhoneNumber(formData.phone_number)) && (
                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>Enter a valid 10-digit number above to enable Call & WhatsApp.</span>
                  </div>
                )}
              </div>

              {/* Collapsible Live Student Search Preview */}
              <div className="border border-[#E5E7EB] rounded-xl p-2.5 bg-[#F8FAFC]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span className="text-xs font-bold text-[#101828]">Student Search Card Preview</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLivePreview(!showLivePreview)}
                    className="text-xs text-[#D97706] font-bold hover:underline cursor-pointer"
                  >
                    {showLivePreview ? '▲ Hide Preview' : '▼ View Card Preview'}
                  </button>
                </div>
                {showLivePreview && (
                  <div className="mt-2.5 max-w-sm mx-auto">
                    <PropertyCard
                      property={previewProperty}
                      onSelect={() => {}}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wizard Controls Sticky Bottom Action Bar */}
          <div className="sticky bottom-[68px] md:bottom-0 z-30 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] rounded-b-2xl sm:rounded-b-3xl shadow-sm flex items-center justify-between">
            {currentStep > 1 ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleStepChange(currentStep - 1)}
                icon={<ArrowLeft className="w-4 h-4" />}
                className="font-bold text-xs"
              >
                Previous
              </Button>
            ) : (
              <div />
            )}

            {currentStep < totalSteps ? (
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={() => handleStepChange(currentStep + 1)}
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
                disabled={currentStep === 1 && !formData.title?.trim()}
                className="font-bold text-xs"
              >
                Next Step
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={handlePublish}
                loading={isSubmitting}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="font-bold text-xs sm:text-sm"
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

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
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { PropertyCard } from '../components/property/PropertyCard';
import { Property, PropertyType, GenderPreference, RoomType, PhonePrivacy, PropertyImage } from '../types';
import { locationRepository } from '../services/locationRepository';
import { evaluateLocationAccuracy } from '../services/location/locationAccuracy';
import { getSupportedCities, getCityConfig, getCityAreas } from '../data/cityAreas';
import { lookupIndianPincode } from '../services/pincodeService';
import { AMENITIES_CATALOG, RULES_CATALOG } from '../config/brand';
import { propertyRepository } from '../services/propertyRepository';
import { uploadPropertyImage } from '../utils/imageUpload';
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
    } catch {
      // Ignore corrupted local storage
    }
    return {
      title: '',
      property_type: 'pg',
      gender_preference: 'male',
      room_type: 'double',
      country: 'India',
      state: 'Uttar Pradesh',
      state_code: 'UP',
      city: 'Prayagraj',
      city_slug: 'prayagraj',
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

  // Photo Upload States & Refs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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

  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, []);

  const handleUseCurrentGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported on this device or browser.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }

    setIsGpsDetecting(true);
    setGpsStatusMessage('Getting precise location (locking GPS satellites)...');
    setGpsError(null);

    let bestCoords: GeolocationCoordinates | null = null;
    let sampleCount = 0;
    const maxSamples = 3;

    const finalizePosition = async (coords: GeolocationCoordinates) => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
      }

      const { latitude, longitude, accuracy } = coords;
      setGpsStatusMessage('Finding address...');

      let revAddress = '';
      let revPincode = '';
      let revState = '';
      let revStateCode = '';
      let revCity = '';
      let revCitySlug = '';
      let revLocality = '';
      let revLocalitySlug = '';
      let revLandmark: string | undefined = undefined;

      try {
        const rev = await locationRepository.reverseGeocodeAsync(latitude, longitude);
        revAddress = rev.formattedAddress || '';
        revPincode = rev.pincode || '';
        revState = rev.state || '';
        revStateCode = rev.stateCode || '';
        revCity = rev.city || '';
        revCitySlug = rev.citySlug || '';
        revLocality = rev.locality || '';
        revLocalitySlug = rev.localitySlug || '';
        revLandmark = rev.landmark;
      } catch {
        const rev = locationRepository.reverseGeocode(latitude, longitude);
        revAddress = rev.displayName;
        revState = rev.stateName;
        revStateCode = rev.stateCode;
        revCity = rev.cityName;
        revCitySlug = rev.citySlug;
        revLocality = rev.localityName;
        revLocalitySlug = rev.localitySlug || '';
        revLandmark = rev.nearestLandmark;
      }

      const evalAcc = evaluateLocationAccuracy(accuracy, 'gps');

      // Check if detected locality is in predefined areas of the city
      const cityAreas = getCityAreas(revCitySlug || 'prayagraj');
      const matchedArea = cityAreas.find(
        (a) => a.toLowerCase() === revLocality.toLowerCase()
      );
      if (!matchedArea && revLocality) {
        setIsManualAreaEntry(true);
      } else if (matchedArea) {
        setIsManualAreaEntry(false);
      }

      setFormData((prev) => ({
        ...prev,
        country: 'India',
        address: revAddress || prev.address,
        pincode: revPincode || prev.pincode,
        state: revState || prev.state || 'Uttar Pradesh',
        state_code: revStateCode || prev.state_code || 'UP',
        city: revCity || prev.city || 'Prayagraj',
        city_slug: revCitySlug || prev.city_slug || 'prayagraj',
        locality: revLocality || prev.locality,
        locality_slug: revLocalitySlug || prev.locality_slug,
        landmark: revLandmark ? `Near ${revLandmark}` : prev.landmark,
        latitude,
        longitude,
      }));

      setIsGpsDetecting(false);
      setGpsStatusMessage('Location detected');
      setIsLocationDetected(true);
      setAccuracyLabel(`GPS accuracy: ±${Math.round(accuracy)} m`);

      if (evalAcc.isLowAccuracy && evalAcc.warningMessage) {
        setGpsError(evalAcc.warningMessage);
      } else {
        setGpsError(null);
      }
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          sampleCount++;
          const coords = pos.coords;
          if (!bestCoords || coords.accuracy < bestCoords.accuracy) {
            bestCoords = coords;
          }

          // If accuracy is high (<= 35m) or reached 3 samples, lock in
          if (coords.accuracy <= 35 || sampleCount >= maxSamples) {
            finalizePosition(bestCoords || coords);
          }
        },
        (err) => {
          if (bestCoords) {
            finalizePosition(bestCoords);
            return;
          }
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          if (timerIdRef.current) {
            clearTimeout(timerIdRef.current);
            timerIdRef.current = null;
          }
          setIsGpsDetecting(false);
          setGpsStatusMessage(null);
          if (err.code === 1) {
            setGpsError('Location permission denied. Please allow location access in your browser or select your area manually.');
          } else if (err.code === 2) {
            setGpsError('Unable to determine location. Please try again or select your area manually.');
          } else if (err.code === 3) {
            setGpsError('Location request timed out. Please try again or select your area manually.');
          } else {
            setGpsError('Unable to determine location. Please try again.');
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );

      // Fallback timer after 5.5s
      timerIdRef.current = setTimeout(() => {
        if (bestCoords) {
          finalizePosition(bestCoords);
        }
      }, 5500);
    } catch {
      setIsGpsDetecting(false);
      setGpsStatusMessage(null);
      setGpsError('Could not start location sensor. Please select your area manually.');
    }
  };

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

    setIsUploadingPhoto(true);
    setUploadError(null);

    try {
      const newImages: PropertyImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const publicUrlOrDataUrl = await uploadPropertyImage(file, currentUser?.id);
        const existingCount = (formData.images || []).length + newImages.length;
        newImages.push({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          url: publicUrlOrDataUrl,
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
      setUploadError('Failed to process one or more images. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
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
    const next = (formData.images || []).filter((i) => i.id !== imgId);
    if (next.length > 0 && !next.some((i) => i.is_cover)) {
      next[0].is_cover = true;
    }
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
              {currentStep === 2 && `Location & Landmarks in ${formData.city || 'Prayagraj'}`}
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
            {/* Quick GPS Capture Card (High Accuracy Satellite Lock) */}
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
                        Doorstep GPS
                      </span>
                    </h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5 max-w-md">
                      Locks onto high-accuracy GPS satellites to attach exact doorstep coordinates and auto-detect your neighborhood.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleUseCurrentGps}
                  disabled={isGpsDetecting}
                  loading={isGpsDetecting}
                  icon={isGpsDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  className="shrink-0 font-bold text-xs w-full sm:w-auto"
                >
                  {isGpsDetecting ? (gpsStatusMessage || 'Detecting...') : '📍 Use Current Location'}
                </Button>
              </div>

              {isLocationDetected && formData.latitude && formData.longitude && !isGpsDetecting && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold">✓ Location detected:</span>
                    <span className="text-white font-semibold">
                      {[formData.locality, formData.city, formData.state].filter(Boolean).join(', ')}{formData.pincode ? ` - ${formData.pincode}` : ''}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-300 font-medium">
                    {accuracyLabel}
                  </span>
                </div>
              )}

              {gpsError && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{gpsError}</span>
                </div>
              )}
            </div>

            {/* City & Predefined / Manual Area Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
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
                      // Only set default coordinates if GPS was not already captured
                      if (!formData.latitude || !formData.longitude) {
                        updateField('latitude', cfg.defaultLat);
                        updateField('longitude', cfg.defaultLon);
                      }
                      // Reset locality if not in the new city's area list
                      const newCityAreas = cfg.areas;
                      if (!newCityAreas.includes(formData.locality || '')) {
                        updateField('locality', '');
                        updateField('locality_slug', '');
                      }
                    }
                  }}
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                    Area / Locality *
                  </label>
                  {!isManualAreaEntry ? (
                    <button
                      type="button"
                      onClick={() => setIsManualAreaEntry(true)}
                      className="text-xs text-[#D97706] hover:underline font-semibold cursor-pointer"
                    >
                      ✏️ Enter manually
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsManualAreaEntry(false)}
                      className="text-xs text-[#2563EB] hover:underline font-semibold cursor-pointer"
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
                      // Preserve exact GPS latitude/longitude if already captured!
                      if (!formData.latitude || !formData.longitude) {
                        const cfg = getCityConfig(formData.city_slug);
                        if (cfg) {
                          updateField('latitude', cfg.defaultLat);
                          updateField('longitude', cfg.defaultLon);
                        }
                      }
                    }}
                    className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                  >
                    <option value="">-- Select Area in {formData.city || 'Prayagraj'} --</option>
                    {getCityAreas(formData.city_slug || 'prayagraj').map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                    <option value="__manual__">+ Can't find your area? Type manually...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.locality || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('locality', val);
                      updateField('locality_slug', val.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      // Preserve exact GPS latitude/longitude if already captured!
                      if (!formData.latitude || !formData.longitude) {
                        const cfg = getCityConfig(formData.city_slug);
                        if (cfg) {
                          updateField('latitude', cfg.defaultLat);
                          updateField('longitude', cfg.defaultLon);
                        }
                      }
                    }}
                    placeholder="e.g. Civil Lines, Katra, Salori, Indira Nagar..."
                    className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
                  />
                )}
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  {!isManualAreaEntry
                    ? `Showing ${getCityAreas(formData.city_slug || 'prayagraj').length} verified localities in ${formData.city || 'Prayagraj'}.`
                    : 'Type your exact mohalla, colony, or sector name.'}
                </p>
              </div>
            </div>

            {/* Optional Search Bar for Quick Locality Autocomplete across India */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2">
              <label className="block text-xs font-bold text-[#101828]">
                Or Search Any Indian Area / Locality:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchLocationQuery}
                  onChange={(e) => {
                    setSearchLocationQuery(e.target.value);
                  }}
                  placeholder="e.g. Civil Lines, Katra, Koramangala, Mukherjee Nagar..."
                  className="w-full p-3 rounded-xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:border-[#F59E0B]"
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
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-[#F8FAFC] text-xs font-semibold text-[#101828] flex items-center justify-between cursor-pointer"
                      >
                        <span>{res.title}</span>
                        <span className="text-[10px] text-[#64748B]">{res.subtitle}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Landmarks and Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                  Nearest College, Metro, or Coaching Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={formData.landmark || ''}
                  onChange={(e) => updateField('landmark', e.target.value)}
                  placeholder="e.g. 200m to Metro Gate, Behind Allahabad University Library"
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
                  placeholder="e.g. 211002, 229001, 110092"
                  className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
                />
                {pincodePostOffices.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[#64748B] font-semibold">📮 Suggested Areas:</span>
                    {pincodePostOffices.map((po) => (
                      <button
                        key={po}
                        type="button"
                        onClick={() => {
                          updateField('locality', po);
                          updateField('locality_slug', po.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                        }}
                        className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Address Line / House / Building Number
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

            {/* Doorstep GPS Precision Badge (No Map) */}
            {formData.latitude && formData.longitude && (
              <div className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50/60 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-emerald-950">GPS Coordinates Attached</h5>
                    <p className="text-[11px] text-emerald-800">
                      Latitude: {Number(formData.latitude).toFixed(6)}, Longitude: {Number(formData.longitude).toFixed(6)} • Doorstep precision walking distance active
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                  Doorstep Precision Active
                </span>
              </div>
            )}
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
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E7EB] shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#101828] font-heading flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#F59E0B]" />
                  <span>Property Photos</span>
                </h3>
                <p className="text-xs text-[#667085] mt-1">
                  Add clear, well-lit photos of the room, bed, bathroom, and building entrance.
                </p>
              </div>

              {/* Dual Action Native Inputs: Gallery + Camera */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. Choose from Gallery */}
                <label
                  className={`relative overflow-hidden flex items-center gap-3.5 p-4 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#101828] bg-[#F8FAFC] hover:bg-white text-[#101828] transition-all shadow-xs active:scale-98 cursor-pointer select-none ${
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
                  <div className="w-11 h-11 rounded-xl bg-amber-100/70 text-[#D97706] flex items-center justify-center shrink-0 pointer-events-none">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-left pointer-events-none">
                    <p className="font-bold text-sm text-[#101828]">Choose from Gallery</p>
                    <p className="text-[11px] text-[#667085]">Select existing device photos</p>
                  </div>
                </label>

                {/* 2. Take Photo with Camera */}
                <label
                  className={`relative overflow-hidden flex items-center gap-3.5 p-4 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#101828] bg-[#F8FAFC] hover:bg-white text-[#101828] transition-all shadow-xs active:scale-98 cursor-pointer select-none ${
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
                  <div className="w-11 h-11 rounded-xl bg-[#101828] text-[#F59E0B] flex items-center justify-center shrink-0 pointer-events-none">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-left pointer-events-none">
                    <p className="font-bold text-sm text-[#101828]">Take Photo with Camera</p>
                    <p className="text-[11px] text-[#667085]">Capture new photo instantly</p>
                  </div>
                </label>
              </div>

              {isUploadingPhoto && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B] shrink-0" />
                  <span>Processing, optimizing and saving photos...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Optional URL input fallback */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-xs font-semibold text-[#667085] hover:text-[#101828] underline cursor-pointer"
                >
                  {showUrlInput ? 'Hide photo URL input' : '+ Or paste a direct image URL'}
                </button>
                {showUrlInput && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Paste direct image URL..."
                      className="flex-1 p-3 rounded-xl border border-[#E5E7EB] text-xs"
                    />
                    <Button variant="primary" size="sm" onClick={handleAddImage}>
                      Add URL
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Photo Previews Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                  Selected Photos ({formData.images?.length || 0})
                </label>
                <span className="text-[11px] text-[#667085]">First photo will be the cover photo</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(formData.images || []).map((img) => (
                  <div
                    key={img.id}
                    className="relative rounded-2xl overflow-hidden border border-[#E5E7EB] group aspect-4/3 bg-[#F8FAFC] shadow-xs"
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {img.is_cover ? (
                      <span className="absolute bottom-2 left-2 text-[10px] bg-[#101828] text-[#F59E0B] px-2 py-0.5 rounded-md font-bold shadow-xs">
                        Cover Photo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetCover(img.id)}
                        className="absolute bottom-2 left-2 text-[10px] bg-black/70 hover:bg-[#101828] text-white px-2 py-0.5 rounded-md font-semibold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        Set as Cover
                      </button>
                    )}
                  </div>
                ))}
              </div>
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

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
  Phone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { PropertyCard } from '../components/property/PropertyCard';
import { Property, PropertyType, GenderPreference, RoomType, PhonePrivacy } from '../types';
import { PRAYAGRAJ_LOCALITIES } from '../config/localities';
import { AMENITIES_CATALOG, RULES_CATALOG } from '../config/brand';
import { propertyRepository } from '../services/propertyRepository';

interface AddPropertyPageProps {
  onSuccess: (newProperty: Property) => void;
  onCancel: () => void;
}

const DRAFT_STORAGE_KEY = 'prayag_living_owner_draft_v1';

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
      locality: 'Katra',
      sub_locality: '',
      landmark: '',
      address: '',
      latitude: 25.4563,
      longitude: 81.8546,
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
      owner_phone: currentUser.phone_number || '+91 94152 38472',
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
    setIsSubmitting(true);
    try {
      const created = await propertyRepository.createProperty({
        ...formData,
        owner_id: currentUser.id,
        owner_name: currentUser.full_name,
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
    owner_id: currentUser.id,
    owner_name: currentUser.full_name,
    owner_phone: formData.phone_privacy === 'public' ? formData.owner_phone : null,
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
    locality: formData.locality || 'Katra',
    landmark: formData.landmark,
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
    pincode: '211002',
    address: formData.address || 'Address',
    latitude: formData.latitude || 25.4563,
    longitude: formData.longitude || 81.8546,
    amenities: formData.amenities || ['wifi'],
    rules: formData.rules || ['quiet_hours'],
    images: formData.images || [],
    phone_privacy: (formData.phone_privacy as PhonePrivacy) || 'private',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    distance_formatted: 'In your locality',
  };

  return (
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
                placeholder="e.g. Saraswati Girls Hostel or Sharma Nilayam PG – Katra"
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
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Student Locality in Prayagraj *
              </label>
              <select
                value={formData.locality}
                onChange={(e) => {
                  const loc = PRAYAGRAJ_LOCALITIES.find((l) => l.name === e.target.value);
                  updateField('locality', e.target.value);
                  if (loc) {
                    updateField('latitude', loc.latitude);
                    updateField('longitude', loc.longitude);
                  }
                }}
                className="w-full p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
              >
                {PRAYAGRAJ_LOCALITIES.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} ({loc.hindi_name}) – {loc.landmark_highlight}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Nearest College or Coaching Landmark *
              </label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) => updateField('landmark', e.target.value)}
                placeholder="e.g. 200m to AU Library Gate, Behind Katra Post Office, Near Dhyeya IAS"
                className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
                Address Line / House Number
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="e.g. 14/B, Old Katra, Near Netram Chauraha"
                className="w-full p-3.5 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#F59E0B] text-sm"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">
                🔒 Note: Exact house address and doorstep coordinates are kept private. The public map shows only approximate neighborhood pins.
              </p>
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
  );
};

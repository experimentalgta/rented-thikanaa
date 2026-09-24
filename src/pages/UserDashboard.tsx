import React, { useState, useEffect } from 'react';
import {
  Building2,
  PlusCircle,
  Eye,
  MessageSquare,
  Users,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Lock,
  Phone,
  ShieldCheck,
  Edit,
  ExternalLink,
  Heart,
  User as UserIcon,
  Trash2,
  Sparkles,
  ArrowRight,
  Share2,
  MapPin,
  Settings,
  Copy,
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { useChat } from '../context/ChatContext';
import { Property, ContactRequest } from '../types';
import { propertyRepository } from '../services/propertyRepository';
import { PropertyCard } from '../components/property/PropertyCard';
import { Button } from '../components/common/Button';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

interface UserDashboardProps {
  initialTab?: string;
  onAddProperty: () => void;
  onSelectProperty: (property: Property) => void;
  onNavigate: (view: string, param?: any) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  initialTab = 'overview',
  onAddProperty,
  onSelectProperty,
  onNavigate,
}) => {
  const { currentUser, updateProfile, signOut } = useAuth();
  const { savedItems, toggleSave } = useSaved();
  const { contactRequests, updateContactRequest, setIsChatModalOpen } = useChat();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingFilter, setListingFilter] = useState<'all' | 'available' | 'paused' | 'rented'>('all');
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);

  // Phone privacy state
  const [phonePrivacy, setPhonePrivacy] = useState<'private' | 'on_request' | 'public'>('private');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);

  // Profile editable fields
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone_number || '');
  const [occupation, setOccupation] = useState(currentUser?.occupation || '');
  const [college, setCollege] = useState(currentUser?.college || '');
  const [budget, setBudget] = useState(currentUser?.budget || 6500);

  const loadMemberProperties = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const all = await propertyRepository.getPropertiesByOwner(currentUser.id);
      setProperties(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setPhoneNumber(currentUser.phone_number || '');
      setOccupation(currentUser.occupation || '');
      setCollege(currentUser.college || '');
      setBudget(currentUser.budget || 6500);
      loadMemberProperties();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleStatusChange = async (
    propertyId: string,
    status: Property['availability_status']
  ) => {
    if (!currentUser) return;
    try {
      await propertyRepository.updatePropertyStatus(propertyId, status, currentUser.id);
      await loadMemberProperties();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteListing = async (propertyId: string, title: string) => {
    if (!currentUser) return;
    const confirmed = window.confirm(`Are you sure you want to delete the listing "${title}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await propertyRepository.deleteProperty(propertyId, currentUser.id);
      await loadMemberProperties();
    } catch (e) {
      console.error('Failed to delete property:', e);
      alert('Could not delete listing. Please try again.');
    }
  };

  const handleShareListing = (property: Property) => {
    const shareUrl = `${window.location.origin}?property=${property.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedPropertyId(property.id);
      setTimeout(() => setCopiedPropertyId(null), 2500);
    }
  };

  const handleSaveProfile = () => {
    updateProfile({
      full_name: fullName,
      phone_number: phoneNumber,
      occupation,
      college,
      budget: Number(budget),
    });
    setProfileSuccessMsg(true);
    setTimeout(() => setProfileSuccessMsg(false), 3000);
  };

  // Segregate contact requests: Received on user's listings vs Sent to other listers
  const receivedInquiries = currentUser
    ? contactRequests.filter((r) => r.receiver_id === currentUser.id)
    : [];

  const sentInquiries = currentUser
    ? contactRequests.filter((r) => r.requester_id === currentUser.id)
    : [];

  const filteredProperties = properties.filter((p) => {
    if (listingFilter === 'all') return true;
    return p.availability_status === listingFilter;
  });

  return (
    <ProtectedRoute
      fallbackTitle="Sign in to view your dashboard"
      fallbackDescription="Please sign in with Google to view and manage your accommodations, saved rooms, and roommate requests."
      pendingAction={{ type: 'dashboard', subTab: initialTab }}
    >
      {currentUser && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
      {/* Top Banner - Unified Member Header */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 mb-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80'}
            alt={currentUser.full_name}
            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#E2E8F0] shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#101828] font-heading">
                {currentUser.full_name}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#101828] text-[#F59E0B]">
                Rented Thikan Member
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-1">
              {currentUser.email} • {currentUser.occupation || 'Aspirant / Professional'}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#101828] font-medium mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Verified Identity • All-India Member Account</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="primary"
            size="md"
            onClick={onAddProperty}
            icon={<PlusCircle className="w-4 h-4 text-[#F59E0B]" />}
            className="font-bold w-full sm:w-auto"
          >
            + List a Room / Property
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsChatModalOpen(true)}
            icon={<MessageSquare className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Messages
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={async () => {
              await signOut();
              onNavigate('home');
            }}
            icon={<LogOut className="w-4 h-4 text-rose-500" />}
            className="w-full sm:w-auto text-rose-600 hover:bg-rose-50 hover:border-rose-200"
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Unified Tab Navigation Bar */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-8 border-b border-[#E5E7EB] no-scrollbar">
        {[
          { id: 'overview', label: 'My Activity' },
          { id: 'listings', label: `My Listings (${properties.length})` },
          { id: 'saved', label: `Saved Rooms (${savedItems.length})` },
          { id: 'messages', label: 'Messages' },
          { id: 'requests', label: `Contact Requests (${receivedInquiries.length + sentInquiries.length})` },
          { id: 'roommates', label: 'Roommate Matches' },
          { id: 'privacy', label: 'Location & Privacy' },
          { id: 'settings', label: 'Settings' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#101828] text-white shadow-xs'
                : 'bg-white text-[#667085] hover:text-[#101828] border border-[#E5E7EB]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW / MY ACTIVITY */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                My Listings
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#101828] font-heading">
                {properties.length}
              </div>
              <span className="text-[11px] text-[#101828] font-semibold">
                {properties.filter((p) => p.availability_status === 'available').length} Active across India
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                Saved Properties
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#101828] font-heading">
                {savedItems.length}
              </div>
              <span className="text-[11px] text-[#F59E0B] font-semibold">Saved for comparison</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                Inquiries &amp; Requests
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#101828] font-heading">
                {receivedInquiries.length + sentInquiries.length}
              </div>
              <span className="text-[11px] text-[#667085]">
                {receivedInquiries.length} received • {sentInquiries.length} sent
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
                Member Status
              </span>
              <div className="text-base sm:text-lg font-bold text-[#101828] flex items-center gap-1 mt-1">
                <ShieldCheck className="w-5 h-5 text-[#F59E0B]" />
                Verified
              </div>
              <span className="text-[10px] text-[#94A3B8]">Phone &amp; Profile verified</span>
            </div>
          </div>

          {/* Dual Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] text-[#92400E] flex items-center justify-center mb-3">
                  <Building2 className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <h3 className="font-bold text-base text-[#101828] font-heading mb-1">
                  Have a Spare Room or Property?
                </h3>
                <p className="text-xs text-[#667085] leading-relaxed mb-4">
                  Any member can list an accommodation or vacant bed in any Indian city. Zero broker commission, private phone options, and instant direct inquiries.
                </p>
              </div>
              <Button variant="primary" size="md" onClick={onAddProperty} icon={<PlusCircle className="w-4 h-4" />}>
                List a Room / Property
              </Button>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] text-[#101828] flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-[#101828]" />
                </div>
                <h3 className="font-bold text-base text-[#101828] font-heading mb-1">
                  Looking for Accommodations or Roommates?
                </h3>
                <p className="text-xs text-[#667085] leading-relaxed mb-4">
                  Explore verified rooms across India sorted naturally by distance, or connect with compatible roommates matching your budget and lifestyle.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="md" onClick={() => onNavigate('search')} fullWidth>
                  Browse Rooms
                </Button>
                <Button variant="outline" size="md" onClick={() => onNavigate('roommates')} fullWidth>
                  Find Roommates
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Preview of Listings & Saved */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Quick My Listings preview */}
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#101828] font-heading">
                  My Recent Listings
                </h3>
                <button
                  onClick={() => setActiveTab('listings')}
                  className="text-xs font-semibold text-[#101828] hover:text-[#F59E0B] flex items-center gap-1 cursor-pointer"
                >
                  Manage All ({properties.length}) <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {properties.slice(0, 2).map((prop) => (
                <div
                  key={prop.id}
                  className="p-3.5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={prop.images[0]?.url}
                      alt={prop.title}
                      className="w-12 h-12 rounded-xl object-cover ring-1 ring-[#E2E8F0] shrink-0"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-[#111827] line-clamp-1">{prop.title}</h4>
                      <span className="text-[11px] text-[#667085]">
                        {prop.locality}, {prop.city} • ₹{prop.rent.toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      prop.availability_status === 'available'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {prop.availability_status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Saved Rooms preview */}
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#101828] font-heading">
                  Saved Accommodations
                </h3>
                <button
                  onClick={() => setActiveTab('saved')}
                  className="text-xs font-semibold text-[#101828] hover:text-[#F59E0B] flex items-center gap-1 cursor-pointer"
                >
                  View All ({savedItems.length}) <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {savedItems.length > 0 ? (
                savedItems.slice(0, 2).map((item) => (
                  <div
                    key={item.property.id}
                    className="p-3.5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.property.images[0]?.url}
                        alt={item.property.title}
                        className="w-12 h-12 rounded-xl object-cover ring-1 ring-[#E2E8F0] shrink-0"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-[#111827] line-clamp-1">
                          {item.property.title}
                        </h4>
                        <span className="text-[11px] text-[#667085]">
                          {item.property.locality}, {item.property.city} • ₹{item.property.rent.toLocaleString('en-IN')}/mo
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectProperty(item.property)}
                      className="text-xs text-[#101828] font-semibold hover:underline shrink-0 cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[#667085]">
                  No saved properties yet. Tap the heart on any listing to save it here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#101828] font-heading">
                Your Accommodations &amp; Vacancies
              </h2>
              <p className="text-xs text-[#667085]">
                Manage availability status, pause listings, edit details, or preview your public listing.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={onAddProperty}
              icon={<PlusCircle className="w-4 h-4 text-[#F59E0B]" />}
              className="font-bold"
            >
              + Add New Listing
            </Button>
          </div>

          {/* Status Filter Bar */}
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3 text-xs">
            <span className="text-[#64748B] font-medium mr-1">Status:</span>
            {[
              { id: 'all', label: `All (${properties.length})` },
              { id: 'available', label: `Active (${properties.filter(p => p.availability_status === 'available').length})` },
              { id: 'paused', label: `Paused (${properties.filter(p => p.availability_status === 'paused').length})` },
              { id: 'rented', label: `Rented (${properties.filter(p => p.availability_status === 'rented').length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setListingFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  listingFilter === f.id
                    ? 'bg-[#101828] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#101828]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredProperties.map((prop) => (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <img
                    src={prop.images[0]?.url}
                    alt={prop.title}
                    className="w-16 h-16 rounded-xl object-cover ring-1 ring-[#E2E8F0] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm text-[#111827] font-heading truncate">
                        {prop.title}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          prop.availability_status === 'available'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : prop.availability_status === 'rented'
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        {prop.availability_status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-[#667085] mt-0.5">
                      {prop.locality}, {prop.city} • ₹{prop.rent.toLocaleString('en-IN')}/mo •{' '}
                      {prop.vacancies} vacancy
                    </div>

                    <div className="text-[11px] text-[#94A3B8] mt-1 flex flex-wrap items-center gap-2">
                      <span>Phone Privacy: {prop.phone_privacy}</span>
                      <span>•</span>
                      <span>Coordinates: Private &amp; Fuzzed on Map</span>
                    </div>
                  </div>
                </div>

                {/* Listing Actions Suite */}
                <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[#F1F5F9]">
                  {/* Preview Button */}
                  <button
                    onClick={() => onSelectProperty(prop)}
                    className="text-xs px-2.5 py-1.5 rounded-xl font-semibold bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827] hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Preview Public Listing"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={() => handleShareListing(prop)}
                    className="text-xs px-2.5 py-1.5 rounded-xl font-semibold bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827] hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Share Listing Link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{copiedPropertyId === prop.id ? 'Copied!' : 'Share'}</span>
                  </button>

                  {/* Availability Toggles */}
                  {prop.availability_status === 'available' ? (
                    <>
                      <button
                        onClick={() => handleStatusChange(prop.id, 'rented')}
                        className="text-xs px-2.5 py-1.5 rounded-xl font-semibold bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827] hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Mark as Rented"
                      >
                        Mark Rented
                      </button>
                      <button
                        onClick={() => handleStatusChange(prop.id, 'paused')}
                        className="text-xs px-2.5 py-1.5 rounded-xl text-[#667085] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        title="Temporarily Pause Inquiries"
                      >
                        Pause
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(prop.id, 'available')}
                      className="text-xs px-2.5 py-1.5 rounded-xl font-semibold bg-[#101828] text-white hover:bg-[#1E293B] transition-colors cursor-pointer"
                    >
                      Make Available
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteListing(prop.id, prop.title)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Listing"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {filteredProperties.length === 0 && (
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-12 text-center">
                <Building2 className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                <h3 className="font-bold text-base text-[#111827] font-heading mb-1">
                  No listings found in this filter
                </h3>
                <p className="text-xs text-[#667085] max-w-sm mx-auto mb-6">
                  Got a spare room, PG bed, or flat across India? Add it to the platform in under 2 minutes.
                </p>
                <Button variant="primary" onClick={onAddProperty} icon={<PlusCircle className="w-4 h-4" />}>
                  List Your Property
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SAVED PROPERTIES */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#101828] font-heading">
                Saved Properties &amp; PGs
              </h2>
              <p className="text-xs text-[#667085]">
                Real-time rent &amp; vacancy tracking for your shortlist.
              </p>
            </div>
            <span className="text-xs text-[#667085]">
              {savedItems.length} saved
            </span>
          </div>

          {savedItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedItems.map((item) => (
                <div key={item.property.id} className="relative">
                  <PropertyCard
                    property={item.property}
                    onSelect={onSelectProperty}
                  />
                  <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-[#64748B]">
                    <span>Saved on {item.saved_date}</span>
                    <button
                      onClick={() => toggleSave(item.property)}
                      className="text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-12 text-center">
              <Heart className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
              <h3 className="font-bold text-base text-[#111827] font-heading mb-1">
                No saved properties yet
              </h3>
              <p className="text-xs text-[#667085] max-w-sm mx-auto mb-6">
                Click the heart icon on any PG, room, or flat while browsing to save it here for comparison.
              </p>
              <Button variant="primary" onClick={() => onNavigate('search')}>
                Browse Accommodations
              </Button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MESSAGES */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFFBEB] text-[#92400E] flex items-center justify-center mx-auto">
            <MessageSquare className="w-7 h-7 text-[#F59E0B]" />
          </div>
          <h3 className="text-lg font-bold text-[#101828] font-heading">
            In-App Messaging Center
          </h3>
          <p className="text-xs text-[#667085] max-w-md mx-auto leading-relaxed">
            Communicate safely with property listers and prospective roommates without sharing your private phone number until you choose to.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsChatModalOpen(true)}
              icon={<MessageSquare className="w-4 h-4" />}
            >
              Open Active Conversations
            </Button>
          </div>
        </div>
      )}

      {/* TAB 5: CONTACT REQUESTS & INQUIRIES */}
      {activeTab === 'requests' && (
        <div className="space-y-8">
          {/* Section 1: Received Inquiries */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#101828] font-heading">
                Received Inquiries (On Your Listings)
              </h2>
              <p className="text-xs text-[#667085]">
                Members interested in your rooms. Accept to exchange direct contact numbers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receivedInquiries.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#111827]">
                      {req.requester_name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === 'accepted'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : req.status === 'pending'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-xs text-[#667085]">
                    Inquiring about:{' '}
                    <span className="font-semibold text-[#111827]">
                      {req.property_title || 'Room Listing'}
                    </span>
                  </div>

                  {req.status === 'accepted' ? (
                    <div className="p-2.5 bg-[#FFFBEB] rounded-xl text-xs font-bold text-[#92400E] flex items-center gap-1.5 border border-[#FDE68A]">
                      <Phone className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>Member Phone: {req.requester_phone || '+91 98394 55123'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => updateContactRequest(req.id, 'accepted')}
                      >
                        Accept &amp; Share Phone
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateContactRequest(req.id, 'rejected')}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {receivedInquiries.length === 0 && (
                <div className="col-span-full p-8 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center text-xs text-[#667085]">
                  No received contact requests on your listings yet.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Sent Inquiries */}
          <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
            <div>
              <h2 className="text-lg font-bold text-[#101828] font-heading">
                Sent Contact Requests (To Other Listers)
              </h2>
              <p className="text-xs text-[#667085]">
                Requests you submitted to view contact numbers or schedule room visits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentInquiries.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#111827]">
                      {req.property_title || 'Contact Request'}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === 'accepted'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : req.status === 'pending'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-[#667085]">
                    Listed by: <span className="font-semibold text-[#111827]">{req.receiver_name}</span>
                  </p>

                  {req.status === 'accepted' ? (
                    <div className="p-2.5 bg-[#FFFBEB] rounded-xl text-xs font-bold text-[#92400E] flex items-center gap-1.5 border border-[#FDE68A]">
                      <Phone className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>Unlocked Phone: {req.receiver_phone || '+91 94152 38472'}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#94A3B8]">
                      Awaiting response from lister. You can message them in chat anytime.
                    </p>
                  )}

                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsChatModalOpen(true)}
                      icon={<MessageSquare className="w-3.5 h-3.5" />}
                    >
                      Open Chat
                    </Button>
                  </div>
                </div>
              ))}

              {sentInquiries.length === 0 && (
                <div className="col-span-full p-8 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center text-xs text-[#667085]">
                  You have not sent any direct contact requests yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ROOMMATE MATCHES & PROFILE */}
      {activeTab === 'roommates' && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
            <div>
              <h2 className="text-lg font-bold text-[#101828] font-heading">
                Roommate Discovery &amp; Compatibility
              </h2>
              <p className="text-xs text-[#667085] mt-1">
                Find flatmates and room-sharers across Indian educational and IT hubs.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('roommates')}
              icon={<Users className="w-4 h-4" />}
            >
              Browse Roommates
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
              <h3 className="text-sm font-bold text-[#101828]">My Roommate Profile Status</h3>
              <p className="text-xs text-[#667085]">
                Your profile is active and discoverable by seekers looking for roommates in your budget range (₹{budget.toLocaleString('en-IN')}/mo).
              </p>
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="font-semibold text-[#111827]">Affiliation:</span>
                <span className="text-[#64748B]">{college}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[#111827]">Target Rent:</span>
                <span className="text-[#64748B]">₹{budget.toLocaleString('en-IN')}/mo</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] space-y-3">
              <div className="flex items-center gap-2 text-[#92400E] font-bold text-sm">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                <span>Smart Compatibility Engine</span>
              </div>
              <p className="text-xs text-[#92400E]/80">
                Matches are calculated based on lifestyle factors: sleep routine, study atmosphere, food preference, and cleanliness.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('roommates')}
                className="border-[#F59E0B] text-[#92400E] hover:bg-[#FEF3C7]"
              >
                Find Compatible Matches
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: LOCATION & PRIVACY */}
      {activeTab === 'privacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Phone Privacy Controls */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="pb-4 border-b border-[#F1F5F9]">
              <h2 className="text-base font-bold text-[#101828] font-heading">
                Phone Number Privacy Controls
              </h2>
              <p className="text-xs text-[#667085] mt-1">
                Rented Thikan is privacy-first. Choose how your phone number is shared with students and listers.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: 'private',
                  label: 'Private (Default & Recommended)',
                  desc: 'Your phone number is never exposed. Members communicate only via in-app chat.',
                },
                {
                  id: 'on_request',
                  label: 'On Request Only (Mutual Exchange)',
                  desc: 'Your phone number is hidden until you explicitly accept a contact request.',
                },
                {
                  id: 'public',
                  label: 'Publicly Visible',
                  desc: 'Your phone number is shown directly on your listings and roommate profile.',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    phonePrivacy === opt.id
                      ? 'border-[#101828] bg-[#F8FAFC]'
                      : 'border-[#E5E7EB] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <input
                    type="radio"
                    name="member_phone_privacy"
                    checked={phonePrivacy === opt.id}
                    onChange={() => setPhonePrivacy(opt.id as any)}
                    className="mt-1 text-[#101828] focus:ring-[#101828]"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#111827]">{opt.label}</div>
                    <div className="text-[11px] text-[#667085] mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Location Safety & Privacy Policy */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="pb-4 border-b border-[#F1F5F9]">
              <h2 className="text-base font-bold text-[#101828] font-heading">
                Location Privacy &amp; Pin Security
              </h2>
              <p className="text-xs text-[#667085] mt-1">
                How Rented Thikan protects your exact address and home location.
              </p>
            </div>

            <div className="space-y-3 text-xs text-[#667085]">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center gap-2 text-[#101828] font-bold text-xs">
                  <MapPin className="w-4 h-4 text-[#F59E0B]" />
                  <span>Public Map Fuzzing Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Exact property coordinates and street house numbers are never exposed on public search maps. Public maps show randomized neighborhood markers (~150–250 meters away).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <div className="flex items-center gap-2 text-[#92400E] font-bold text-xs">
                  <Lock className="w-4 h-4 text-[#F59E0B]" />
                  <span>Private In-Chat Location Unlocking</span>
                </div>
                <p className="text-[11px] text-[#92400E]/90 leading-relaxed">
                  Exact house directions and Google Maps navigation are only revealed when the lister explicitly clicks "Share Exact Location" inside an authenticated conversation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="pb-4 border-b border-[#F1F5F9]">
            <h2 className="text-base font-bold text-[#101828] font-heading">
              Member Profile &amp; Account Settings
            </h2>
            <p className="text-xs text-[#667085] mt-1">
              Update your account details visible across Rented Thikan.
            </p>
          </div>

          {profileSuccessMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#F59E0B]" />
              Settings and profile updated successfully!
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#667085] uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#667085] uppercase tracking-wider mb-1">
                Verified Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#667085] uppercase tracking-wider mb-1">
                Occupation / Focus
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. UPSC Aspirant / Working Professional / Student"
                className="w-full p-3 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#667085] uppercase tracking-wider mb-1">
                College / Organization
              </label>
              <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#667085] uppercase tracking-wider mb-1">
                Monthly Target Budget (₹)
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full p-3 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button variant="primary" size="md" onClick={handleSaveProfile}>
              Save Profile Changes
            </Button>
          </div>

          <div className="pt-6 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-rose-700">Account Session</h3>
              <p className="text-[11px] text-[#667085]">Sign out of your Rented Thikan session on this browser.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                onNavigate('home');
              }}
              icon={<LogOut className="w-4 h-4 text-rose-500" />}
              className="text-rose-600 hover:bg-rose-50 hover:border-rose-300 w-full sm:w-auto"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}
        </div>
      )}
    </ProtectedRoute>
  );
};

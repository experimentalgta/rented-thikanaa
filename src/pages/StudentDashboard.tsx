import React, { useState } from 'react';
import {
  Heart,
  MessageSquare,
  Phone,
  ShieldCheck,
  User,
  CheckCircle2,
  Lock,
  Clock,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { useChat } from '../context/ChatContext';
import { PropertyCard } from '../components/property/PropertyCard';
import { Button } from '../components/common/Button';
import { Property } from '../types';

interface StudentDashboardProps {
  initialTab?: string;
  onSelectProperty: (property: Property) => void;
  onNavigate: (view: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  initialTab = 'saved',
  onSelectProperty,
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const { savedItems, toggleSave } = useSaved();
  const { contactRequests, setIsChatModalOpen } = useChat();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [phonePrivacy, setPhonePrivacy] = useState<'private' | 'on_request' | 'public'>('private');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
      {/* Student Profile Overview Banner */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 mb-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80'}
            alt={currentUser.full_name}
            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#E2E8F0]"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#101828] font-heading">
                {currentUser.full_name}
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                Student
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              {currentUser.email} • Allahabad University Aspirant
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mobile Verified Student Account</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'saved'
                ? 'bg-[#101828] text-white shadow-xs'
                : 'bg-[#F8FAFC] text-[#667085] hover:text-[#101828] border border-[#E2E8F0]'
            }`}
          >
            Saved Rooms ({savedItems.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'requests'
                ? 'bg-[#101828] text-white shadow-xs'
                : 'bg-[#F8FAFC] text-[#667085] hover:text-[#101828] border border-[#E2E8F0]'
            }`}
          >
            Contact Requests ({contactRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'privacy'
                ? 'bg-[#101828] text-white shadow-xs'
                : 'bg-[#F8FAFC] text-[#667085] hover:text-[#101828] border border-[#E2E8F0]'
            }`}
          >
            Privacy Settings
          </button>
        </div>
      </div>

      {/* Tab 1: Saved Properties */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#101828] font-heading">
              Your Saved Properties &amp; PGs
            </h2>
            <span className="text-xs text-[#667085]">
              Real-time rent &amp; availability tracking
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
                      className="text-rose-600 hover:underline flex items-center gap-1"
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
                Click the heart icon on any PG, room, or hostel while browsing in Katra or Civil Lines to track it here.
              </p>
              <Button variant="primary" onClick={() => onNavigate('search')}>
                Browse Student Accommodations
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Contact Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-[#101828] font-heading">
            Contact Requests &amp; Phone Sharing
          </h2>

          <div className="space-y-3">
            {contactRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[#111827]">
                      {req.property_title || 'Direct Contact Request'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-[#667085]">
                    Host: <span className="font-semibold text-[#111827]">{req.receiver_name}</span>
                  </p>

                  {/* Phone reveal if accepted */}
                  {req.status === 'accepted' && (
                    <div className="mt-2 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Unlocked Phone: {req.receiver_phone || '+91 94152 38472'}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsChatModalOpen(true)}
                    icon={<MessageSquare className="w-4 h-4" />}
                  >
                    Open Chat
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Phone Privacy Settings */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 space-y-6 max-w-2xl">
          <div className="pb-4 border-b border-[#F1F5F9]">
            <h2 className="text-lg font-bold text-[#101828] font-heading">
              Phone Number Privacy Controls
            </h2>
            <p className="text-xs text-[#667085] mt-1">
              PrayagLiving is built on privacy-first communication. Control exactly who can view your phone number.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'private',
                label: 'Private (Default & Recommended)',
                desc: 'Your phone number is never exposed. Students and owners communicate only via in-app chat.',
              },
              {
                id: 'on_request',
                label: 'On Request Only',
                desc: 'Your phone number is hidden until you explicitly accept a contact request.',
              },
              {
                id: 'public',
                label: 'Publicly Visible',
                desc: 'Your phone number is shown directly on your student roommate profile.',
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
                  name="phone_privacy_opt"
                  checked={phonePrivacy === opt.id}
                  onChange={() => setPhonePrivacy(opt.id as any)}
                  className="mt-1 text-[#101828] focus:ring-[#101828]"
                />
                <div>
                  <div className="text-sm font-bold text-[#111827]">{opt.label}</div>
                  <div className="text-xs text-[#667085] mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <Button variant="primary" size="md">
              Save Privacy Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

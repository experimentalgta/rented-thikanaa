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
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Property, ContactRequest } from '../types';
import { propertyRepository } from '../services/propertyRepository';
import { Button } from '../components/common/Button';

interface OwnerDashboardProps {
  onAddProperty: () => void;
  onSelectProperty: (property: Property) => void;
  onNavigate: (view: string) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  onAddProperty,
  onSelectProperty,
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const { contactRequests, updateContactRequest, setIsChatModalOpen } = useChat();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOwnerProperties = async () => {
    setLoading(true);
    try {
      const all = await propertyRepository.getPropertiesByOwner(currentUser.id);
      // If user has no properties, also include the sample owner-101 properties for testing
      if (all.length === 0) {
        const fallback = await propertyRepository.getPropertiesByOwner('owner-101');
        setProperties(fallback);
      } else {
        setProperties(all);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerProperties();
  }, [currentUser.id]);

  const handleStatusChange = async (
    propertyId: string,
    status: Property['availability_status']
  ) => {
    try {
      await propertyRepository.updatePropertyStatus(propertyId, status);
      await loadOwnerProperties();
    } catch (e) {
      console.error(e);
    }
  };

  const incomingRequests = contactRequests.filter((r) => r.receiver_role === 'owner');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 mb-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-[#101828] font-heading">
              {currentUser.full_name} Dashboard
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#101828] text-white">
              Host / Owner
            </span>
          </div>
          <p className="text-xs text-[#667085]">
            Manage student rooms, PGs, vacancy availability, and student contact requests.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={onAddProperty}
          icon={<PlusCircle className="w-5 h-5" />}
          className="font-bold"
        >
          + Add New Property
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
            Active Listings
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#101828] font-heading">
            {properties.filter((p) => p.availability_status === 'available').length}
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">Live in Prayagraj</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
            Student Views
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#101828] font-heading">
            842
          </div>
          <span className="text-[11px] text-[#F59E0B] font-semibold">Last 30 Days</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
            Contact Requests
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#101828] font-heading">
            {incomingRequests.length}
          </div>
          <span className="text-[11px] text-[#667085]">Pending student inquiries</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-1">
            Verification
          </span>
          <div className="text-base sm:text-lg font-bold text-emerald-800 flex items-center gap-1 mt-1">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Verified Host
          </div>
          <span className="text-[10px] text-[#94A3B8]">Government ID on file</span>
        </div>
      </div>

      {/* Main Grid: Listings Table & Contact Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: My Listed Properties */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#101828] font-heading">
              Your Accommodations &amp; Vacancies
            </h2>
            <span className="text-xs text-[#667085]">
              {properties.length} total properties
            </span>
          </div>

          <div className="space-y-4">
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={prop.images[0]?.url}
                    alt={prop.title}
                    className="w-16 h-16 rounded-xl object-cover ring-1 ring-[#E2E8F0] shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#111827] font-heading">
                        {prop.title}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          prop.availability_status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : prop.availability_status === 'rented'
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {prop.availability_status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-[#667085] mt-0.5">
                      {prop.locality} • ₹{prop.rent.toLocaleString('en-IN')}/mo •{' '}
                      {prop.vacancies} vacancy
                    </div>

                    <div className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-2">
                      <span>Phone: {prop.phone_privacy}</span>
                      <span>•</span>
                      <button
                        onClick={() => onSelectProperty(prop)}
                        className="text-[#101828] hover:underline flex items-center gap-0.5 font-medium"
                      >
                        View Public Page <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Availability Actions */}
                <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                  {prop.availability_status === 'available' ? (
                    <button
                      onClick={() => handleStatusChange(prop.id, 'rented')}
                      className="text-xs px-3 py-1.5 rounded-xl font-semibold bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827] hover:bg-slate-100 transition-colors"
                      title="Mark as Rented to remove from search"
                    >
                      Mark as Rented
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(prop.id, 'available')}
                      className="text-xs px-3 py-1.5 rounded-xl font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      Make Available
                    </button>
                  )}

                  {prop.availability_status === 'available' && (
                    <button
                      onClick={() => handleStatusChange(prop.id, 'paused')}
                      className="text-xs px-2.5 py-1.5 rounded-xl text-[#667085] hover:bg-[#F8FAFC] transition-colors"
                    >
                      Pause
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Student Contact Requests */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-[#101828] font-heading">
            Student Inquiries &amp; Requests
          </h2>

          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#111827]">
                    {req.requester_name}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      req.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-[#667085]">
                  Inquiring about:{' '}
                  <span className="font-semibold text-[#111827]">
                    {req.property_title || 'Room in Katra'}
                  </span>
                </div>

                {req.status === 'accepted' ? (
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-1.5 border border-emerald-200">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Student Phone: {req.requester_phone || '+91 98394 55123'}</span>
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

            {incomingRequests.length === 0 && (
              <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center text-xs text-[#667085]">
                No pending contact requests at this moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

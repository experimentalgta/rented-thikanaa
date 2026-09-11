import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  Eye,
  Trash2,
  ExternalLink,
  Lock
} from 'lucide-react';
import { Property, Report } from '../types';
import { propertyRepository } from '../services/propertyRepository';
import { chatAndSafetyRepository } from '../services/safetyAndChatRepository';
import { Button } from '../components/common/Button';

interface AdminDashboardProps {
  onSelectProperty: (property: Property) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSelectProperty,
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listings' | 'reports'>('listings');

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const props = await propertyRepository.getAllPropertiesAdmin();
      setProperties(props);
      const reps = await chatAndSafetyRepository.getReports();
      setReports(reps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleVerifyProperty = async (propertyId: string) => {
    try {
      await propertyRepository.verifyProperty(propertyId, 'platform_verified');
      await loadAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReportAction = async (reportId: string, status: Report['status']) => {
    try {
      await chatAndSafetyRepository.updateReportStatus(reportId, status);
      await loadAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
      {/* Admin Header */}
      <div className="bg-[#101828] text-white rounded-3xl p-6 sm:p-8 mb-8 border border-[#1E293B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-[#F59E0B]" />
            <h1 className="text-xl sm:text-2xl font-bold font-heading">
              PrayagLiving Trust &amp; Safety Panel
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Moderation center for Prayagraj student housing. Review pending listings, verify owner identities, and resolve student safety reports.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('listings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'listings'
                ? 'bg-[#F59E0B] text-[#101828]'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            All Listings ({properties.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'reports'
                ? 'bg-[#F59E0B] text-[#101828]'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            Safety Reports ({reports.filter((r) => r.status === 'pending').length})
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase block">
            Total Properties
          </span>
          <span className="text-2xl font-black text-[#101828] font-heading">
            {properties.length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase block">
            Verified Properties
          </span>
          <span className="text-2xl font-black text-emerald-800 font-heading">
            {properties.filter((p) => p.is_verified).length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase block">
            Pending Reports
          </span>
          <span className="text-2xl font-black text-rose-700 font-heading">
            {reports.filter((r) => r.status === 'pending').length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase block">
            Demo Listings
          </span>
          <span className="text-2xl font-black text-[#64748B] font-heading">
            {properties.filter((p) => p.is_demo).length}
          </span>
        </div>
      </div>

      {/* Tab 1: Listings Review & Verification */}
      {activeTab === 'listings' && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#101828] font-heading">
            All Listings &amp; Moderation
          </h2>
          <div className="divide-y divide-[#F1F5F9] overflow-x-auto">
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={prop.images[0]?.url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover ring-1 ring-[#E2E8F0]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#111827]">{prop.title}</h4>
                      {prop.is_verified ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                          Unverified
                        </span>
                      )}
                      {prop.is_demo && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          Demo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#667085] mt-0.5">
                      {prop.locality} • ₹{prop.rent.toLocaleString('en-IN')}/mo • Owner:{' '}
                      {prop.owner_name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onSelectProperty(prop)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155]"
                  >
                    View Listing
                  </button>
                  {!prop.is_verified && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleVerifyProperty(prop.id)}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Issue Verification
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Reports Queue */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#101828] font-heading">
            Flagged Content &amp; User Safety Reports
          </h2>
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                      {rep.reason.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-xs text-[#111827]">
                      Entity: {rep.reported_entity_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">
                    Reported by {rep.reporter_name}
                  </span>
                </div>

                {rep.notes && (
                  <p className="text-xs text-[#475569] bg-white p-3 rounded-xl border border-[#E2E8F0]">
                    "{rep.notes}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-[#64748B]">
                    Status: <strong className="uppercase">{rep.status}</strong>
                  </span>

                  {rep.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReportAction(rep.id, 'dismissed')}
                      >
                        Dismiss
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleReportAction(rep.id, 'action_taken')}
                      >
                        Take Action / Delist
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {reports.length === 0 && (
              <div className="p-8 text-center text-xs text-[#667085]">
                No safety reports on file.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

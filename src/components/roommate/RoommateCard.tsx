import React from 'react';
import {
  Sparkles,
  MapPin,
  GraduationCap,
  Calendar,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Lock,
  Phone,
  ShieldCheck
} from 'lucide-react';
import { StudentProfile } from '../../types';
import { Button } from '../common/Button';

interface RoommateCardProps {
  roommate: StudentProfile;
  onMessage: (roommate: StudentProfile) => void;
  onRequestContact: (roommate: StudentProfile) => void;
}

export const RoommateCard: React.FC<RoommateCardProps> = ({
  roommate,
  onMessage,
  onRequestContact,
}) => {
  const compatibilityScore = roommate.compatibility_score || 85;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]';
    if (score >= 70) return 'bg-blue-50 text-blue-800 border-blue-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Strong Match';
    if (score >= 70) return 'Good Match';
    return 'Moderate Match';
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#CBD5E1] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Header with Avatar & Compatibility Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={
                roommate.avatar_url ||
                'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80'
              }
              alt={roommate.full_name}
              className="w-13 h-13 rounded-xl object-cover ring-2 ring-[#E2E8F0] shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base text-[#111827] font-heading">
                  {roommate.full_name}
                </h3>
                {roommate.is_demo && (
                  <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-500">
                    Demo
                  </span>
                )}
              </div>
              <div className="text-xs text-[#667085] flex items-center gap-1 mt-0.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                <span className="truncate max-w-[200px]">{roommate.college}</span>
              </div>
              {roommate.course && (
                <div className="text-[11px] text-[#94A3B8]">{roommate.course}</div>
              )}
            </div>
          </div>

          {/* Compatibility Badge */}
          <div
            className={`px-2.5 py-1 rounded-full border text-xs font-bold flex items-center gap-1 shrink-0 ${getScoreColor(
              compatibilityScore
            )}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>{compatibilityScore}% Match</span>
          </div>
        </div>

        {/* Bio */}
        <p className="text-xs text-[#475569] leading-relaxed mb-4 line-clamp-3 bg-[#F8FAFC] p-3 rounded-xl border border-[#F1F5F9]">
          "{roommate.bio}"
        </p>

        {/* Target Budget & Move-in details */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] block">
              Budget Target
            </span>
            <span className="font-extrabold text-sm text-[#101828] font-heading">
              ₹{roommate.budget_min.toLocaleString('en-IN')} – ₹{roommate.budget_max.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-[#94A3B8]">/ month</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] block">
              Move-in Timing
            </span>
            <span className="font-semibold text-xs text-[#101828] flex items-center gap-1 mt-1">
              <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
              {roommate.target_move_in}
            </span>
          </div>
        </div>

        {/* Preferred Localities */}
        <div className="mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block mb-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#F59E0B]" />
            Preferred Areas
          </span>
          <div className="flex flex-wrap gap-1">
            {roommate.preferred_areas.map((area) => (
              <span
                key={area}
                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#334155]"
              >
                {area}
              </span>
            ))}
          </div>
        </div>

        {/* Transparent Matching Factors Breakdown */}
        {roommate.compatibility_breakdown && (
          <div className="mb-5 pt-3 border-t border-[#F1F5F9]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-1.5">
              Compatibility Factors ({getScoreLabel(compatibilityScore)})
            </span>
            <div className="space-y-1">
              {roommate.compatibility_breakdown.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 text-[11px] text-[#334155]"
                >
                  {item.matched ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phone Privacy Notice & Actions */}
      <div className="pt-3 border-t border-[#F1F5F9]">
        <div className="flex items-center gap-1 text-[11px] text-[#64748B] mb-3">
          <Lock className="w-3 h-3 text-[#F59E0B]" />
          <span>Phone number private until contact request accepted</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMessage(roommate)}
            icon={<MessageSquare className="w-3.5 h-3.5" />}
          >
            Message
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onRequestContact(roommate)}
            icon={<Phone className="w-3.5 h-3.5" />}
          >
            Request Contact
          </Button>
        </div>
      </div>
    </div>
  );
};

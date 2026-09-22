import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Report } from '../../types';
import { chatAndSafetyRepository } from '../../services/safetyAndChatRepository';
import { useAuth } from '../../context/AuthContext';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'property' | 'user';
  entityId: string;
  entityName: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}) => {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState<Report['reason']>('wrong_information');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const reportReasons: { id: Report['reason']; label: string; description: string }[] = [
    {
      id: 'fake_listing',
      label: 'Fake or Non-Existent Listing',
      description: 'Property does not exist or photos belong to another building.',
    },
    {
      id: 'scam',
      label: 'Financial Fraud / Advance Scam',
      description: 'Owner demanded non-refundable token money before showing the room.',
    },
    {
      id: 'wrong_information',
      label: 'Incorrect Rent or Amenities',
      description: 'Actual rent, electricity bills, or amenities differ substantially from listing.',
    },
    {
      id: 'property_unavailable',
      label: 'Property Already Rented Out',
      description: 'Owner confirmed room is filled but has not updated listing status.',
    },
    {
      id: 'inappropriate_behaviour',
      label: 'Inappropriate or Unsafe Behaviour',
      description: 'Owner or student exhibited rude, harassing, or discriminatory conduct.',
    },
    {
      id: 'other',
      label: 'Other Trust & Safety Concern',
      description: 'Any other issue requiring trust and moderation team investigation.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await chatAndSafetyRepository.submitReport({
        reporterId: currentUser.id,
        reporterName: currentUser.full_name,
        reportedEntityType: entityType,
        reportedEntityId: entityId,
        reportedEntityName: entityName,
        reason,
        notes,
      });
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setNotes('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="w-5 h-5" />
          <span>Report {entityType === 'property' ? 'Listing' : 'User'}</span>
        </div>
      }
    >
      {isSuccess ? (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-[#111827] font-heading mb-2">
            Report Received
          </h4>
          <p className="text-xs text-[#667085] leading-relaxed max-w-xs mx-auto mb-6">
            Thank you for helping keep Rented Thikan safe. Our trust and safety team has flagged "{entityName}" for review within 24 hours.
          </p>
          <Button onClick={handleClose} variant="dark" fullWidth>
            Back to Listing
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs">
            <span className="text-[#64748B]">Reporting: </span>
            <span className="font-semibold text-[#101828]">{entityName}</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-2">
              Reason for Report
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {reportReasons.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    reason === r.id
                      ? 'border-[#101828] bg-[#F8FAFC]'
                      : 'border-[#E5E7EB] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="mt-0.5 text-[#101828] focus:ring-[#101828]"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#111827]">{r.label}</div>
                    <div className="text-[11px] text-[#667085]">{r.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1">
              Additional Evidence or Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide specific details (e.g., date of visit, phone discussion, discrepancy)..."
              className="w-full text-xs p-3 rounded-xl border border-[#E5E7EB] focus:outline-none focus:border-[#101828] bg-[#F8FAFC]"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} fullWidth>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={isSubmitting} fullWidth>
              Submit Report
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

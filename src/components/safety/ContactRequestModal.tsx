import React, { useState } from 'react';
import { ShieldCheck, Phone, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Property } from '../../types';

interface ContactRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  onSuccess?: () => void;
}

export const ContactRequestModal: React.FC<ContactRequestModalProps> = ({
  isOpen,
  onClose,
  property,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { sendContactRequest } = useChat();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      await sendContactRequest({
        id: property.id,
        title: property.title,
        owner_id: property.owner_id,
        owner_name: property.owner_name,
      });
      setSent(true);
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 text-[#101828]">
          <ShieldCheck className="w-5 h-5 text-[#F59E0B]" />
          <span>Phone Privacy &amp; Contact Request</span>
        </div>
      }
    >
      {sent ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-amber-50 text-[#D97706] rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-[#111827] font-heading mb-1.5">
            Contact Request Sent
          </h4>
          <p className="text-xs text-[#667085] leading-relaxed max-w-xs mx-auto mb-5">
            We notified <span className="font-semibold text-[#111827]">{property.owner_name}</span>. Once they accept your request, both of your contact numbers will unlock securely.
          </p>
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs text-[#475569] mb-5">
            You can also continue chatting via in-platform messaging anytime.
          </div>
          <Button onClick={handleClose} variant="primary" fullWidth>
            Got it
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 bg-[#FFFBEB] rounded-xl border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Phone Number Protected</span>
              <p className="mt-0.5 leading-relaxed text-[11px] text-[#B45309]">
                To prevent spam and protect privacy, lister phone numbers are private by default. Sending a request lets the lister review your member profile before exchanging phone numbers.
              </p>
            </div>
          </div>

          <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Property:</span>
              <span className="font-semibold text-[#111827] truncate max-w-[200px]">
                {property.title}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Listed by / Host:</span>
              <span className="font-medium text-[#111827]">{property.lister_name || property.owner_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Your Phone to Share:</span>
              <span className="font-medium text-[#111827]">
                {currentUser?.phone_number || currentUser?.email || 'Registered account'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} fullWidth>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSend}
              loading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              fullWidth
            >
              Send Request
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

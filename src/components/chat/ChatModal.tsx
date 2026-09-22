import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Building2,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Lock,
  MapPin,
  Navigation,
  ExternalLink,
  PhoneCall,
  Copy,
  Check,
  Share2
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { propertyRepository } from '../../services/propertyRepository';

export const ChatModal: React.FC = () => {
  const {
    isChatModalOpen,
    setIsChatModalOpen,
    conversations,
    activeConversation,
    selectConversation,
    messages,
    sendMessage,
    contactRequests,
    updateContactRequest,
    shareExactLocation,
  } = useChat();

  const { currentUser } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // State for Location Sharing Modal
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [exactAddress, setExactAddress] = useState('');
  const [landmarkDirections, setLandmarkDirections] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update default modal values when active conversation changes
  useEffect(() => {
    if (activeConversation?.property_id) {
      propertyRepository.getPropertyById(activeConversation.property_id, 'owner-101').then((prop) => {
        if (prop) {
          setExactAddress(
            prop.address && prop.address !== `${prop.locality}, Prayagraj`
              ? prop.address
              : `House #14/B, ${prop.locality}, Prayagraj, UP 211002`
          );
          setLandmarkDirections(
            prop.landmark
              ? `Directions: Near ${prop.landmark}. Paved lane opposite main gate, 3rd house with yellow gate.`
              : `Directions: Central ${prop.locality}, 200m from main market.`
          );
          setGoogleMapsUrl(
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${prop.locality} Prayagraj Uttar Pradesh India`
            )}`
          );
          setWhatsappUrl(
            prop.owner_phone
              ? `https://wa.me/${prop.owner_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Namaste, I am arriving for the visit to ${prop.title}`
                )}`
              : 'https://wa.me/919415238472?text=Namaste%2C%20I%20am%20arriving%20for%20the%20property%20visit'
          );
        }
      });
    } else {
      setExactAddress('14/B, Old Katra, Near Netram Chauraha, Prayagraj, UP 211002');
      setLandmarkDirections('Take the paved lane opposite Netram Chauraha, 3rd house on the left.');
      setGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=25.4578,81.8539');
      setWhatsappUrl('https://wa.me/919415238472?text=Namaste%20visiting%20property');
    }
  }, [activeConversation?.id, activeConversation?.property_id]);

  if (!isChatModalOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsSending(true);
    try {
      await sendMessage(inputText.trim());
      setInputText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exactAddress.trim()) return;

    try {
      await shareExactLocation({
        exact_address: exactAddress.trim(),
        landmark_directions: landmarkDirections.trim() || undefined,
        google_maps_url:
          googleMapsUrl.trim() ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            exactAddress.trim()
          )}`,
        whatsapp_url: whatsappUrl.trim() || undefined,
        shared_at: new Date().toISOString(),
      });
      setIsLocationModalOpen(false);
    } catch (err) {
      console.error('Failed to share exact location:', err);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Find if there's an associated contact request with this conversation's property/participants
  const relevantRequest = contactRequests.find(
    (r) =>
      r.property_id === activeConversation?.property_id ||
      (activeConversation?.participant_ids.includes(r.requester_id) &&
        activeConversation?.participant_ids.includes(r.receiver_id))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#101828]/60 backdrop-blur-xs"
        onClick={() => setIsChatModalOpen(false)}
      />

      {/* Main Chat Window */}
      <div className="relative w-full max-w-3xl h-[85vh] sm:h-[650px] bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] flex flex-col z-10 overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#101828] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B] text-[#101828] flex items-center justify-center font-bold font-heading">
              💬
            </div>
            <div>
              <h3 className="font-bold text-sm font-heading">
                {activeConversation?.property_title
                  ? activeConversation.property_title
                  : 'In-Platform Messages'}
              </h3>
              <p className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#F59E0B]" />
                Privacy-Protected Communication
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsChatModalOpen(false)}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split View */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left Column: Conversations List (Hidden on small mobile if viewing thread) */}
          <div className="hidden md:flex flex-col w-64 border-r border-[#E5E7EB] bg-[#F8FAFC]">
            <div className="p-3 border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Recent Chats
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
              {conversations.map((conv) => {
                const isActive = activeConversation?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-3 text-left transition-colors flex items-start gap-2.5 ${
                      isActive ? 'bg-white font-medium shadow-2xs' : 'hover:bg-white/60'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#E2E8F0] flex items-center justify-center text-xs font-bold shrink-0">
                      {conv.property_title?.charAt(0) || 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-xs font-semibold text-[#111827] truncate">
                          {conv.property_title || 'Chat'}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] shrink-0">
                          {conv.last_message_time}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {conv.last_message}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Message Thread */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Context Banner */}
            {activeConversation?.property_title && (
              <div className="p-2.5 px-4 bg-[#FFFBEB] border-b border-[#FDE68A] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 truncate max-w-full sm:max-w-xs">
                  <Building2 className="w-4 h-4 text-[#D97706] shrink-0" />
                  <span className="text-[#92400E] font-medium truncate">
                    Inquiry: <strong>{activeConversation.property_title}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Share Exact Location Action Button (For Host/Owner or testing) */}
                  <button
                    onClick={() => setIsLocationModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#101828] text-white text-[11px] font-semibold hover:bg-[#F59E0B] hover:text-[#101828] shadow-2xs transition-all cursor-pointer"
                    title="Send exact doorstep address and directions"
                  >
                    <MapPin className="w-3 h-3 text-[#F59E0B]" />
                    <span>Share Exact Location</span>
                  </button>

                  {/* Contact Request Status Badge inside chat */}
                  {relevantRequest ? (
                    relevantRequest.status === 'accepted' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#D97706]" />
                        Phone: {relevantRequest.receiver_phone || relevantRequest.requester_phone}
                      </span>
                    ) : relevantRequest.status === 'pending' &&
                      currentUser && relevantRequest.receiver_id === currentUser.id ? (
                      <button
                        onClick={() => updateContactRequest(relevantRequest.id, 'accepted')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#101828] text-white hover:bg-[#F59E0B] hover:text-[#101828] transition-colors"
                      >
                        Accept Phone Request
                      </button>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Phone Request Pending
                      </span>
                    )
                  ) : null}
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]">
              {messages.map((msg) => {
                const isMe = currentUser ? msg.sender_id === currentUser.id : false;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-[#94A3B8] mb-1 px-1">
                      {isMe ? 'You' : msg.sender_name} • {msg.timestamp}
                    </div>

                    {/* Standard Message Bubble */}
                    <div
                      className={`max-w-[90%] sm:max-w-md p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isMe
                          ? 'bg-[#101828] text-white rounded-br-xs shadow-xs'
                          : 'bg-white text-[#111827] border border-[#E5E7EB] rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      <div>{msg.text}</div>

                      {/* Rich Location Card if location was shared */}
                      {msg.location_share && (
                        <div className="mt-3 p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#111827] shadow-2xs space-y-2.5 text-left">
                          <div className="flex items-center justify-between pb-1.5 border-b border-[#FDE68A]/60">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#92400E]">
                              <MapPin className="w-4 h-4 text-[#D97706]" />
                              <span>Exact Location Details</span>
                            </div>
                            <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#FDE68A]">
                              Shared by Host
                            </span>
                          </div>

                          {/* Doorstep Address */}
                          <div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#92400E] mb-0.5 flex items-center justify-between">
                              <span>Doorstep Address</span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(msg.id, msg.location_share!.exact_address)
                                }
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#64748B] hover:text-[#101828] transition-colors cursor-pointer"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#D97706]" />
                                    <span className="text-[#92400E]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-xs font-semibold text-[#101828] bg-white/80 p-2 rounded-lg border border-[#FDE68A]/50">
                              {msg.location_share.exact_address}
                            </div>
                          </div>

                          {/* Directions / Landmark Instructions */}
                          {msg.location_share.landmark_directions && (
                            <div className="bg-white/80 p-2 rounded-lg border border-[#FDE68A]/50">
                              <div className="text-[10px] font-bold text-[#92400E] flex items-center gap-1 mb-0.5">
                                <Navigation className="w-3 h-3 text-[#D97706]" />
                                <span>Directions / Landmarks:</span>
                              </div>
                              <p className="text-[11px] text-[#475569] leading-relaxed">
                                {msg.location_share.landmark_directions}
                              </p>
                            </div>
                          )}

                          {/* Action Links */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <a
                              href={msg.location_share.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101828] text-white text-[11px] font-semibold hover:bg-[#1E293B] transition-colors shadow-2xs"
                            >
                              <ExternalLink className="w-3 h-3 text-[#F59E0B]" />
                              <span>Open in Google Maps</span>
                            </a>

                            {msg.location_share.whatsapp_url && (
                              <a
                                href={msg.location_share.whatsapp_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101828] text-[#F59E0B] border border-[#334155] text-[11px] font-semibold hover:bg-[#1E293B] transition-colors shadow-2xs"
                              >
                                <PhoneCall className="w-3 h-3 text-[#F59E0B]" />
                                <span>WhatsApp Host</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input Box */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-[#E5E7EB] bg-white flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message or inquiry..."
                className="flex-1 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#111827] focus:outline-none focus:border-[#F59E0B]"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!inputText.trim()}
                loading={isSending}
                icon={<Send className="w-4 h-4" />}
              >
                Send
              </Button>
            </form>
          </div>

          {/* Location Sharing Dialog Modal */}
          {isLocationModalOpen && (
            <div className="absolute inset-0 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4 z-30">
              <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-[#101828] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#F59E0B]" />
                    <h4 className="text-sm font-bold font-heading">
                      Share Exact Location with Student
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleShareLocationSubmit} className="p-4 sm:p-5 space-y-4">
                  <p className="text-xs text-[#64748B]">
                    Strict Location Privacy keeps your exact coordinates and doorstep house number hidden publicly.
                    Use this form to share exact navigation instructions with this student.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-[#101828] mb-1">
                      Exact Doorstep Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={exactAddress}
                      onChange={(e) => setExactAddress(e.target.value)}
                      placeholder="e.g. 14/B, Old Katra, Near Netram Chauraha, Prayagraj"
                      className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#101828] mb-1">
                      Directions / Landmark Instructions (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={landmarkDirections}
                      onChange={(e) => setLandmarkDirections(e.target.value)}
                      placeholder="e.g. Opposite Netram Chauraha, enter the lane and look for 3rd house with green gate."
                      className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#101828] mb-1">
                      Google Maps Navigation URL
                    </label>
                    <input
                      type="url"
                      value={googleMapsUrl}
                      onChange={(e) => setGoogleMapsUrl(e.target.value)}
                      placeholder="https://www.google.com/maps/search/?api=1&query=..."
                      className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#101828] mb-1">
                      WhatsApp Contact Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={whatsappUrl}
                      onChange={(e) => setWhatsappUrl(e.target.value)}
                      placeholder="https://wa.me/919415238472?text=..."
                      className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLocationModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      icon={<Share2 className="w-3.5 h-3.5" />}
                    >
                      Send Location to Student
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

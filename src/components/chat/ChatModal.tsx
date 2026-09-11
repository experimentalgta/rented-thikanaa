import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Building2,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

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
  } = useChat();

  const { currentUser } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

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
        <div className="flex flex-1 overflow-hidden">
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
              <div className="p-2.5 px-4 bg-[#FFFBEB] border-b border-[#FDE68A] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="w-4 h-4 text-[#D97706] shrink-0" />
                  <span className="text-[#92400E] font-medium truncate">
                    Inquiry regarding: <strong>{activeConversation.property_title}</strong>
                  </span>
                </div>

                {/* Contact Request Status Badge inside chat */}
                {relevantRequest ? (
                  relevantRequest.status === 'accepted' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Contact Shared: {relevantRequest.receiver_phone || relevantRequest.requester_phone}
                    </span>
                  ) : relevantRequest.status === 'pending' &&
                    relevantRequest.receiver_id === currentUser.id ? (
                    <button
                      onClick={() => updateContactRequest(relevantRequest.id, 'accepted')}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-[#101828] text-white hover:bg-[#F59E0B] hover:text-[#101828] transition-colors"
                    >
                      Accept Contact Request
                    </button>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Contact Request Pending
                    </span>
                  )
                ) : null}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]">
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-[#94A3B8] mb-1 px-1">
                      {isMe ? 'You' : msg.sender_name} • {msg.timestamp}
                    </div>
                    <div
                      className={`max-w-[85%] sm:max-w-md p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isMe
                          ? 'bg-[#101828] text-white rounded-br-xs shadow-xs'
                          : 'bg-white text-[#111827] border border-[#E5E7EB] rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {msg.text}
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
        </div>
      </div>
    </div>
  );
};

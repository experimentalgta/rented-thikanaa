import React, { createContext, useContext, useState, useEffect } from 'react';
import { Conversation, Message, ContactRequest, ContactRequestStatus } from '../types';
import { chatAndSafetyRepository } from '../services/safetyAndChatRepository';
import { useAuth } from './AuthContext';

interface ChatContextType {
  conversations: Conversation[];
  messages: Message[];
  activeConversation: Conversation | null;
  contactRequests: ContactRequest[];
  unreadCount: number;
  openChatWithContext: (property: { id: string; title: string; locality: string; rent: number; owner_id: string; owner_name: string }) => void;
  selectConversation: (conv: Conversation) => void;
  sendMessage: (text: string) => Promise<void>;
  sendContactRequest: (property: { id: string; title: string; owner_id: string; owner_name: string }) => Promise<ContactRequest>;
  updateContactRequest: (requestId: string, status: ContactRequestStatus) => Promise<void>;
  shareExactLocation: (locationShare: import('../types').ExactLocationShare) => Promise<void>;
  isChatModalOpen: boolean;
  setIsChatModalOpen: (open: boolean) => void;
  refreshChatData: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const convs = await chatAndSafetyRepository.getConversations(currentUser.id);
      setConversations(convs);

      const reqs = await chatAndSafetyRepository.getContactRequests(currentUser.id);
      setContactRequests(reqs);

      if (activeConversation) {
        const msgs = await chatAndSafetyRepository.getMessages(activeConversation.id);
        setMessages(msgs);
      } else if (convs.length > 0) {
        setActiveConversation(convs[0]);
        const msgs = await chatAndSafetyRepository.getMessages(convs[0].id);
        setMessages(msgs);
      }
    } catch (e) {
      console.error('Failed to load chat data', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  useEffect(() => {
    if (activeConversation) {
      chatAndSafetyRepository.getMessages(activeConversation.id).then(setMessages);
    }
  }, [activeConversation?.id]);

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    const msgs = await chatAndSafetyRepository.getMessages(conv.id);
    setMessages(msgs);
  };

  const openChatWithContext = async (property: {
    id: string;
    title: string;
    locality: string;
    rent: number;
    owner_id: string;
    owner_name: string;
  }) => {
    setIsChatModalOpen(true);
    // Find existing or initialize temporary
    const existing = conversations.find(
      (c) => c.participant_ids.includes(property.owner_id) && c.property_id === property.id
    );

    if (existing) {
      await selectConversation(existing);
    } else {
      // Auto-send initial inquiry with property context
      const newMsg = await chatAndSafetyRepository.sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.full_name,
        receiverId: property.owner_id,
        text: `Hi, I am inquiring about "${property.title}" in ${property.locality}. Is this still available for visit?`,
        propertyContext: {
          id: property.id,
          title: property.title,
          locality: property.locality,
          rent: property.rent,
        },
      });

      await loadData();
      const updatedConvs = await chatAndSafetyRepository.getConversations(currentUser.id);
      const target = updatedConvs.find((c) => c.property_id === property.id);
      if (target) {
        setActiveConversation(target);
        setMessages([newMsg]);
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!activeConversation) return;

    const otherParticipantId = activeConversation.participant_ids.find(
      (id) => id !== currentUser.id
    ) || 'owner-101';

    const sent = await chatAndSafetyRepository.sendMessage({
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      senderName: currentUser.full_name,
      receiverId: otherParticipantId,
      text,
      propertyContext: activeConversation.property_id
        ? {
            id: activeConversation.property_id,
            title: activeConversation.property_title || '',
            locality: 'Prayagraj',
            rent: 0,
          }
        : undefined,
    });

    setMessages((prev) => [...prev, sent]);
    loadData();
  };

  const sendContactRequest = async (property: {
    id: string;
    title: string;
    owner_id: string;
    owner_name: string;
  }) => {
    const req = await chatAndSafetyRepository.sendContactRequest({
      propertyId: property.id,
      propertyTitle: property.title,
      requesterId: currentUser.id,
      requesterName: currentUser.full_name,
      requesterRole: 'member',
      requesterPhone: currentUser.phone_number,
      receiverId: property.owner_id,
      receiverName: property.owner_name,
      receiverRole: 'lister',
    });

    await loadData();
    return req;
  };

  const updateContactRequest = async (requestId: string, status: ContactRequestStatus) => {
    await chatAndSafetyRepository.updateContactRequestStatus(requestId, status);
    await loadData();
  };

  const shareExactLocation = async (locationShare: import('../types').ExactLocationShare) => {
    if (!activeConversation) return;

    const otherParticipantId =
      activeConversation.participant_ids.find((id) => id !== currentUser.id) || 'user-stud-1';

    const sent = await chatAndSafetyRepository.sendMessage({
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      senderName: currentUser.full_name,
      receiverId: otherParticipantId,
      text: `📍 Exact Location Shared: ${locationShare.exact_address}`,
      propertyContext: activeConversation.property_id
        ? {
            id: activeConversation.property_id,
            title: activeConversation.property_title || '',
            locality: 'Prayagraj',
            rent: 0,
          }
        : undefined,
      locationShare,
    });

    setMessages((prev) => [...prev, sent]);
    await loadData();
  };

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        messages,
        activeConversation,
        contactRequests,
        unreadCount,
        openChatWithContext,
        selectConversation,
        sendMessage,
        sendContactRequest,
        updateContactRequest,
        shareExactLocation,
        isChatModalOpen,
        setIsChatModalOpen,
        refreshChatData: loadData,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
};

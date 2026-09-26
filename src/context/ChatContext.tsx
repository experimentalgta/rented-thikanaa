import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, ContactRequest, ContactRequestStatus, Property } from '../types';
import { chatAndSafetyRepository } from '../services/safetyAndChatRepository';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatContextType {
  conversations: Conversation[];
  messages: Message[];
  activeConversation: Conversation | null;
  contactRequests: ContactRequest[];
  unreadCount: number;
  openChatForListing: (property: Property) => Promise<void>;
  openChatWithContext: (property: {
    id: string;
    title: string;
    locality: string;
    rent: number;
    owner_id: string;
    owner_name: string;
    created_by?: string;
  }) => Promise<void>;
  selectConversation: (conv: Conversation) => Promise<void>;
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
  const { currentUser, requireAuth } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Mutable refs to prevent stale closures in event listeners and channels
  const activeConversationRef = useRef<Conversation | null>(null);
  activeConversationRef.current = activeConversation;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const activeChannelRef = useRef<RealtimeChannel | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser) {
      setConversations([]);
      setContactRequests([]);
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    try {
      const convs = await chatAndSafetyRepository.getConversations(currentUser.id);
      setConversations(convs);

      const reqs = await chatAndSafetyRepository.getContactRequests(currentUser.id);
      setContactRequests(reqs);

      if (activeConversationRef.current) {
        const msgs = await chatAndSafetyRepository.getMessages(activeConversationRef.current.id);
        setMessages(msgs);
      }
    } catch (e) {
      console.error('[ChatContext] Failed to load chat data', e);
    }
  }, [currentUser]);

  // Reset or load initial data on user auth change
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setContactRequests([]);
      setActiveConversation(null);
      setMessages([]);
      setIsChatModalOpen(false);
    } else {
      loadData();
    }
  }, [currentUser?.id, loadData]);

  // Load messages whenever activeConversation changes
  useEffect(() => {
    if (activeConversation && currentUser && !activeConversation.id.startsWith('temp-')) {
      chatAndSafetyRepository.getMessages(activeConversation.id).then((msgs) => {
        setMessages(msgs);
      });
    }
  }, [activeConversation?.id, currentUser?.id]);

  // =========================================================================
  // SUPABASE REALTIME: ACTIVE CONVERSATION CHANNEL
  // =========================================================================
  useEffect(() => {
    if (!activeConversation?.id || activeConversation.id.startsWith('temp-') || !currentUser || !supabase) {
      return;
    }

    const convId = activeConversation.id;
    const channelName = `conv_${convId}`;

    if (import.meta.env.DEV) {
      console.log(`[Chat Realtime] Subscribing to channel ${channelName} for conversation ${convId}`);
    }

    const channel = supabase.channel(channelName);

    // 1. Listen for new messages inserted in the database
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      },
      (payload) => {
        const newRow = payload.new as any;
        if (!newRow || newRow.conversation_id !== convId) return;

        if (import.meta.env.DEV) {
          console.log(`[Chat Realtime] Incoming postgres_changes message: ${newRow.id}`);
        }

        const currentActive = activeConversationRef.current;
        const senderName =
          newRow.sender_id === currentUserRef.current?.id
            ? (currentUserRef.current?.full_name || 'You')
            : (currentActive?.participant_names?.[newRow.sender_id] || 'User');

        const incomingMsg: Message = {
          id: newRow.id,
          conversation_id: newRow.conversation_id,
          sender_id: newRow.sender_id,
          sender_name: senderName,
          receiver_id: newRow.receiver_id,
          text: newRow.text,
          timestamp: newRow.created_at
            ? new Date(newRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Just now',
          is_read: Boolean(newRow.is_read),
          property_context: newRow.property_context,
        };

        // Deduplicated append to messages
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) {
            return prev;
          }
          return [...prev, incomingMsg];
        });

        // Update last message in conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  last_message: incomingMsg.text,
                  last_message_time: incomingMsg.timestamp,
                }
              : c
          )
        );
      }
    );

    // 2. Listen for peer WebSocket broadcast messages
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (!payload || payload.conversation_id !== convId) return;

      if (import.meta.env.DEV) {
        console.log(`[Chat Realtime] Incoming broadcast message: ${payload.id}`);
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) {
          return prev;
        }
        return [...prev, payload];
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                last_message: payload.text,
                last_message_time: payload.timestamp,
              }
            : c
        )
      );
    });

    channel.subscribe((status) => {
      if (import.meta.env.DEV) {
        console.log(`[Chat Realtime] Channel status for ${channelName}: ${status}`);
      }
    });

    activeChannelRef.current = channel;

    return () => {
      if (import.meta.env.DEV) {
        console.log(`[Chat Realtime] Unsubscribing from channel ${channelName}`);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
      activeChannelRef.current = null;
    };
  }, [activeConversation?.id, currentUser?.id]);

  // =========================================================================
  // SUPABASE REALTIME: USER-LEVEL NOTIFICATION CHANNEL
  // =========================================================================
  useEffect(() => {
    if (!currentUser?.id || !supabase) return;

    const userChannelName = `user_${currentUser.id}`;
    const userChannel = supabase.channel(userChannelName);

    userChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          const activeId = activeConversationRef.current?.id;

          // If the message is for the currently open conversation, append it if not already present
          if (activeId && activeId === newRow.conversation_id) {
            const senderName =
              activeConversationRef.current?.participant_names?.[newRow.sender_id] || 'User';

            const incomingMsg: Message = {
              id: newRow.id,
              conversation_id: newRow.conversation_id,
              sender_id: newRow.sender_id,
              sender_name: senderName,
              receiver_id: newRow.receiver_id,
              text: newRow.text,
              timestamp: newRow.created_at
                ? new Date(newRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now',
              is_read: Boolean(newRow.is_read),
              property_context: newRow.property_context,
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) return prev;
              return [...prev, incomingMsg];
            });
          } else {
            // For other conversations: update unread counts and last message
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === newRow.conversation_id);
              if (exists) {
                return prev.map((c) =>
                  c.id === newRow.conversation_id
                    ? {
                        ...c,
                        last_message: newRow.text,
                        last_message_time: 'Just now',
                        unread_count: (c.unread_count || 0) + 1,
                      }
                    : c
                );
              } else {
                // Brand new conversation thread
                loadData();
                return prev;
              }
            });
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[Chat Realtime] User channel status for ${userChannelName}: ${status}`);
        }
      });

    return () => {
      if (supabase && userChannel) {
        supabase.removeChannel(userChannel);
      }
    };
  }, [currentUser?.id, loadData]);

  // =========================================================================
  // CANONICAL CHAT ROUTING: OPEN CHAT FOR LISTING
  // =========================================================================
  const openChatForListing = async (property: Property) => {
    const ownerId = property.owner_id || property.created_by;

    if (!ownerId) {
      console.warn('[ChatContext] Cannot open chat: Listing has no owner ID', property.id);
      return;
    }

    // 1. Enforce authentication
    if (!currentUser) {
      requireAuth(`Sign in with Google to chat with the lister for "${property.title}".`, {
        type: 'chat',
        propertyId: property.id,
        property,
        context: {
          id: property.id,
          title: property.title,
          locality: property.locality,
          rent: property.rent,
          owner_id: ownerId,
          owner_name: property.lister_name || property.owner_name || 'Host / Owner',
        },
      });
      return;
    }

    // 2. Prevent self-chatting: User owns this listing
    if (currentUser.id === ownerId || (property.created_by && currentUser.id === property.created_by)) {
      if (import.meta.env.DEV) {
        console.log('[ChatContext] Blocked attempt to chat with self on owned listing');
      }
      return;
    }

    // 3. Immediately set an accurate active conversation placeholder
    // This PREVENTS flashing stale conversations or picking conversations[0]
    const immediatePlaceholder: Conversation = {
      id: `temp-${property.id}`,
      participant_ids: [currentUser.id, ownerId],
      participant_names: {
        [currentUser.id]: currentUser.full_name || 'You',
        [ownerId]: property.lister_name || property.owner_name || 'Host / Owner',
      },
      participant_avatars: {
        [currentUser.id]: currentUser.avatar_url,
        [ownerId]: property.lister_avatar || property.owner_avatar,
      },
      last_message: '',
      last_message_time: 'Just now',
      unread_count: 0,
      property_id: property.id,
      property_title: property.title,
    };

    setActiveConversation(immediatePlaceholder);
    setMessages([]);
    setIsChatModalOpen(true);

    try {
      // 4. Deterministically resolve or create the conversation record in Supabase
      const resolvedConv = await chatAndSafetyRepository.getOrCreateConversation({
        userId: currentUser.id,
        ownerId,
        propertyId: property.id,
        propertyTitle: property.title,
        ownerName: property.lister_name || property.owner_name,
        ownerAvatar: property.lister_avatar || property.owner_avatar,
        userName: currentUser.full_name,
        userAvatar: currentUser.avatar_url,
      });

      // 5. Update active conversation with canonical DB record
      setActiveConversation(resolvedConv);

      // Ensure conversation is in the left sidebar / thread list
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === resolvedConv.id);
        if (exists) {
          return prev.map((c) => (c.id === resolvedConv.id ? { ...c, ...resolvedConv } : c));
        }
        return [resolvedConv, ...prev];
      });

      // Load existing messages for this conversation
      const existingMsgs = await chatAndSafetyRepository.getMessages(resolvedConv.id);
      setMessages(existingMsgs);
    } catch (err) {
      console.error('[ChatContext] Failed to resolve conversation for listing:', err);
    }
  };

  // Backwards-compatible / generic chat opener (e.g. for roommate or custom inquiries)
  const openChatWithContext = async (property: {
    id: string;
    title: string;
    locality: string;
    rent: number;
    owner_id: string;
    owner_name: string;
    created_by?: string;
  }) => {
    const ownerId = property.owner_id || property.created_by;

    if (!ownerId) {
      console.warn('[ChatContext] Missing owner ID in openChatWithContext', property);
      return;
    }

    if (
      !requireAuth(
        `Sign in with Google to message the lister for "${property.title}".`,
        { type: 'chat', context: property }
      )
    ) {
      return;
    }

    if (!currentUser) return;

    // Prevent self-chat
    if (currentUser.id === ownerId || (property.created_by && currentUser.id === property.created_by)) {
      return;
    }

    // Set immediate placeholder
    const placeholder: Conversation = {
      id: `temp-${property.id}`,
      participant_ids: [currentUser.id, ownerId],
      participant_names: {
        [currentUser.id]: currentUser.full_name || 'You',
        [ownerId]: property.owner_name || 'Host / Owner',
      },
      last_message: '',
      last_message_time: 'Just now',
      unread_count: 0,
      property_id: property.id,
      property_title: property.title,
    };

    setActiveConversation(placeholder);
    setMessages([]);
    setIsChatModalOpen(true);

    try {
      const resolvedConv = await chatAndSafetyRepository.getOrCreateConversation({
        userId: currentUser.id,
        ownerId,
        propertyId: property.id.startsWith('roommate-') ? undefined : property.id,
        propertyTitle: property.title,
        ownerName: property.owner_name,
        userName: currentUser.full_name,
      });

      setActiveConversation(resolvedConv);

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === resolvedConv.id);
        if (exists) {
          return prev.map((c) => (c.id === resolvedConv.id ? { ...c, ...resolvedConv } : c));
        }
        return [resolvedConv, ...prev];
      });

      const existingMsgs = await chatAndSafetyRepository.getMessages(resolvedConv.id);
      setMessages(existingMsgs);
    } catch (err) {
      console.error('[ChatContext] Failed to resolve conversation in openChatWithContext:', err);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    try {
      const msgs = await chatAndSafetyRepository.getMessages(conv.id);
      setMessages(msgs);
    } catch (err) {
      console.error('[ChatContext] Failed to load messages for conversation:', err);
    }
  };

  const sendMessage = async (text: string) => {
    if (!activeConversation || !currentUser) return;

    const otherParticipantId = activeConversation.participant_ids.find(
      (id) => id !== currentUser.id
    );

    if (!otherParticipantId) return;

    const isTempId = activeConversation.id.startsWith('temp-');

    const sent = await chatAndSafetyRepository.sendMessage({
      conversationId: isTempId ? undefined : activeConversation.id,
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

    // If conversation was a placeholder, update to the newly assigned UUID
    if (isTempId && sent.conversation_id) {
      setActiveConversation((prev) => (prev ? { ...prev, id: sent.conversation_id } : prev));
    }

    // 1. Deduplicated local state update
    setMessages((prev) => {
      if (prev.some((m) => m.id === sent.id)) return prev;
      return [...prev, sent];
    });

    // 2. Peer WebSocket broadcast
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: sent,
      });
    }

    // 3. Update conversations list
    setConversations((prev) =>
      prev.map((c) =>
        c.id === (isTempId ? sent.conversation_id : activeConversation.id)
          ? {
              ...c,
              id: sent.conversation_id,
              last_message: sent.text,
              last_message_time: sent.timestamp,
            }
          : c
      )
    );
  };

  const sendContactRequest = async (property: {
    id: string;
    title: string;
    owner_id: string;
    owner_name: string;
  }) => {
    if (!currentUser) {
      throw new Error('Authentication required to send contact requests.');
    }

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
    if (!activeConversation || !currentUser) return;

    const otherParticipantId =
      activeConversation.participant_ids.find((id) => id !== currentUser.id) || 'user-stud-1';

    const sent = await chatAndSafetyRepository.sendMessage({
      conversationId: activeConversation.id.startsWith('temp-') ? undefined : activeConversation.id,
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

    setMessages((prev) => {
      if (prev.some((m) => m.id === sent.id)) return prev;
      return [...prev, sent];
    });

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: sent,
      });
    }

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
        openChatForListing,
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

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, ContactRequest, ContactRequestStatus, Property } from '../types';
import { chatAndSafetyRepository } from '../services/safetyAndChatRepository';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { showBrowserNotification, requestNotificationPermission } from '../utils/notifications';

export interface IncomingToast {
  id: string;
  conversationId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  propertyTitle?: string;
}

interface ChatContextType {
  conversations: Conversation[];
  messages: Message[];
  isLoadingMessages: boolean;
  activeConversation: Conversation | null;
  contactRequests: ContactRequest[];
  unreadCount: number;
  incomingToast: IncomingToast | null;
  dismissToast: () => void;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [isChatModalOpen, setIsChatModalOpenState] = useState(false);
  const [incomingToast, setIncomingToast] = useState<IncomingToast | null>(null);

  // Mutable refs to prevent stale closures in event listeners and channels
  const activeConversationRef = useRef<Conversation | null>(null);
  activeConversationRef.current = activeConversation;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const isChatModalOpenRef = useRef(isChatModalOpen);
  isChatModalOpenRef.current = isChatModalOpen;

  const conversationsRef = useRef<Conversation[]>(conversations);
  conversationsRef.current = conversations;

  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const activeChannelRef = useRef<RealtimeChannel | null>(null);

  // In-memory per-conversation message cache for instant zero-flash switching & session persistence
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());

  // Sequential request ID counter to guarantee that only the latest active conversation fetch updates UI
  const fetchRequestIdRef = useRef<number>(0);

  const dismissToast = useCallback(() => {
    setIncomingToast(null);
  }, []);

  const loadData = useCallback(async () => {
    if (!currentUser) {
      setConversations([]);
      setContactRequests([]);
      setActiveConversation(null);
      setMessages([]);
      setIsLoadingMessages(false);
      messagesCacheRef.current.clear();
      return;
    }

    try {
      const convs = await chatAndSafetyRepository.getConversations(currentUser.id);
      setConversations(convs);

      const reqs = await chatAndSafetyRepository.getContactRequests(currentUser.id);
      setContactRequests(reqs);

      const currentActive = activeConversationRef.current;
      if (currentActive && !currentActive.id.startsWith('temp-')) {
        const msgs = await chatAndSafetyRepository.getMessages(currentActive.id);
        messagesCacheRef.current.set(currentActive.id, msgs);
        if (activeConversationRef.current?.id === currentActive.id) {
          setMessages(msgs);
        }
      }
    } catch (e) {
      console.error('[ChatContext] Failed to load chat data', e);
    }
  }, [currentUser]);

  // Mark conversation as read in both optimistic state and Supabase database
  const markConversationAsRead = useCallback(async (conversationId: string) => {
    const currentUserId = currentUserRef.current?.id;
    if (!currentUserId || !conversationId || conversationId.startsWith('temp-')) return;

    // 1. Optimistically reset conversation's unread_count to 0
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
    );

    // 2. Dismiss any active toast for this conversation
    setIncomingToast((prev) => (prev?.conversationId === conversationId ? null : prev));

    // 3. Persist read status to Supabase
    try {
      await chatAndSafetyRepository.markConversationAsRead(conversationId, currentUserId);
    } catch (e) {
      console.warn('[ChatContext] Failed to mark messages as read in DB:', e);
    }
  }, []);

  const setIsChatModalOpen = useCallback((open: boolean) => {
    setIsChatModalOpenState(open);
    isChatModalOpenRef.current = open;
    if (open && activeConversationRef.current?.id && !activeConversationRef.current.id.startsWith('temp-')) {
      markConversationAsRead(activeConversationRef.current.id);
    }
  }, [markConversationAsRead]);

  // Reset or load initial data on user auth change
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setContactRequests([]);
      setActiveConversation(null);
      setMessages([]);
      setIsLoadingMessages(false);
      messagesCacheRef.current.clear();
      setIsChatModalOpenState(false);
      isChatModalOpenRef.current = false;
      setIncomingToast(null);
    } else {
      loadData();
    }
  }, [currentUser?.id, loadData]);

  // Synchronize / load messages strictly for the active conversation
  useEffect(() => {
    if (!currentUser || !activeConversation) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    const convId = activeConversation.id;

    // Placeholder conversation (new listing inquiry, no messages yet until first send)
    if (convId.startsWith('temp-')) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    // Check if we already have non-empty cached messages for this conversation
    const cached = messagesCacheRef.current.get(convId);
    if (cached && cached.length > 0) {
      // Show cached messages instantly — no loading flash
      setMessages(cached);
      setIsLoadingMessages(false);
    } else {
      // Immediately clear visible messages to prevent ANY visual bleed from previously viewed conversation
      setMessages([]);
      setIsLoadingMessages(true);
    }

    // Capture request ID for stale-fetch invalidation
    const currentRequestId = ++fetchRequestIdRef.current;
    let isCancelled = false;

    chatAndSafetyRepository
      .getMessages(convId)
      .then((msgs) => {
        if (isCancelled) return;

        // Cache the latest messages for this conversation
        messagesCacheRef.current.set(convId, msgs);

        // Strict guard: Only update UI if this fetch belongs to the currently active conversation and latest request
        if (
          fetchRequestIdRef.current === currentRequestId &&
          activeConversationRef.current?.id === convId
        ) {
          setMessages(msgs);
          setIsLoadingMessages(false);
        } else if (import.meta.env.DEV) {
          console.log(
            `[ChatContext] Discarded stale messages response for ${convId}. Active conversation is now: ${activeConversationRef.current?.id}`
          );
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error(`[ChatContext] Failed to load messages for ${convId}:`, err);
        if (
          fetchRequestIdRef.current === currentRequestId &&
          activeConversationRef.current?.id === convId
        ) {
          setIsLoadingMessages(false);
        }
      });

    // Cleanup: mark this effect instance as cancelled to ignore its in-flight response
    return () => {
      isCancelled = true;
    };
  }, [activeConversation?.id, currentUser?.id]);

  // Handle window focus & tab visibility changes to mark active conversation as read
  useEffect(() => {
    const handleFocus = () => {
      if (
        typeof document !== 'undefined' &&
        !document.hidden &&
        isChatModalOpenRef.current &&
        activeConversationRef.current?.id &&
        !activeConversationRef.current.id.startsWith('temp-')
      ) {
        markConversationAsRead(activeConversationRef.current.id);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [markConversationAsRead]);

  // =========================================================================
  // UNIFIED INCOMING MESSAGE PROCESSOR
  // Handles deduplication, active view detection, unread counting & notifications
  // =========================================================================
  const handleIncomingMessage = useCallback(
    (newRow: any) => {
      if (!newRow || !newRow.id || !newRow.conversation_id) return;

      // 1. Deduplication guard
      if (processedMessageIdsRef.current.has(newRow.id)) {
        return;
      }
      processedMessageIdsRef.current.add(newRow.id);

      // Prune deduplication cache when large
      if (processedMessageIdsRef.current.size > 1000) {
        const ids = Array.from(processedMessageIdsRef.current);
        ids.slice(0, 500).forEach((id) => processedMessageIdsRef.current.delete(id));
      }

      const currentUserId = currentUserRef.current?.id;
      const isSentByMe = Boolean(currentUserId && newRow.sender_id === currentUserId);
      const convId = newRow.conversation_id;

      // Identify sender info
      const existingConv = conversationsRef.current.find((c) => c.id === convId);
      const senderName = isSentByMe
        ? (currentUserRef.current?.full_name || 'You')
        : (existingConv?.participant_names?.[newRow.sender_id] || newRow.sender_name || 'User');
      const senderAvatar = isSentByMe
        ? currentUserRef.current?.avatar_url
        : (existingConv?.participant_avatars?.[newRow.sender_id]);

      const incomingMsg: Message = {
        id: newRow.id,
        conversation_id: convId,
        sender_id: newRow.sender_id,
        sender_name: senderName,
        receiver_id: newRow.receiver_id,
        text: newRow.text,
        timestamp: newRow.created_at
          ? new Date(newRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : (newRow.timestamp || 'Just now'),
        is_read: Boolean(newRow.is_read),
        property_context: newRow.property_context,
        location_share: newRow.location_share,
      };

      // Update cache for this conversation so it is immediately available on switch
      const currentCached = messagesCacheRef.current.get(convId) || [];
      if (!currentCached.some((m) => m.id === incomingMsg.id)) {
        messagesCacheRef.current.set(convId, [...currentCached, incomingMsg]);
      }

      // Check if user is actively viewing this exact conversation right now
      const isActivelyViewing =
        isChatModalOpenRef.current &&
        activeConversationRef.current?.id === convId &&
        typeof document !== 'undefined' &&
        !document.hidden;

      if (isActivelyViewing) {
        // SCENARIO 1: User is actively looking at this conversation
        incomingMsg.is_read = true;

        // Append to active message thread
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;
          return [...prev, incomingMsg];
        });

        // Update conversation preview and keep unread_count at 0
        setConversations((prev) => {
          const found = prev.find((c) => c.id === convId);
          if (found) {
            const updated = {
              ...found,
              last_message: incomingMsg.text,
              last_message_time: incomingMsg.timestamp,
              unread_count: 0,
            };
            return [updated, ...prev.filter((c) => c.id !== convId)];
          }
          loadData();
          return prev;
        });

        // Mark as read in DB if incoming from recipient
        if (!isSentByMe && currentUserId) {
          chatAndSafetyRepository.markConversationAsRead(convId, currentUserId).catch(console.warn);
        }
      } else {
        // SCENARIO 2: Inactive conversation, modal closed, or tab in background
        if (activeConversationRef.current?.id === convId) {
          // If modal was already pointing to this conversation, keep message list updated
          setMessages((prev) => {
            if (prev.some((m) => m.id === incomingMsg.id)) return prev;
            return [...prev, incomingMsg];
          });
        }

        // Only increment unread if the message was sent to ME
        const isTargetedToMe = !isSentByMe && currentUserId && newRow.receiver_id === currentUserId;

        setConversations((prev) => {
          const found = prev.find((c) => c.id === convId);
          if (found) {
            const updated = {
              ...found,
              last_message: incomingMsg.text,
              last_message_time: incomingMsg.timestamp,
              unread_count: isTargetedToMe ? (found.unread_count || 0) + 1 : (found.unread_count || 0),
            };
            // Re-order active thread to top
            return [updated, ...prev.filter((c) => c.id !== convId)];
          } else {
            // New conversation created by another party
            loadData();
            return prev;
          }
        });

        // Show In-App Toast & Browser Notification if targeted to me
        if (isTargetedToMe) {
          setIncomingToast({
            id: incomingMsg.id,
            conversationId: convId,
            senderName: senderName !== 'User' ? senderName : 'Someone',
            senderAvatar,
            text: incomingMsg.text,
            propertyTitle: existingConv?.property_title || newRow.property_context?.title,
          });

          showBrowserNotification({
            title: `New message from ${senderName}`,
            body: incomingMsg.text,
            tag: `msg-${convId}`,
            onClick: () => {
              if (existingConv) {
                setActiveConversation(existingConv);
                markConversationAsRead(convId);
              }
              setIsChatModalOpen(true);
            },
          });
        }
      }
    },
    [loadData, markConversationAsRead, setIsChatModalOpen]
  );

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

    // 1. Listen for new messages inserted in database
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
        handleIncomingMessage(newRow);
      }
    );

    // 2. Listen for peer WebSocket broadcast messages
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (!payload || payload.conversation_id !== convId) return;
      handleIncomingMessage(payload);
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
  }, [activeConversation?.id, currentUser?.id, handleIncomingMessage]);

  // =========================================================================
  // SUPABASE REALTIME: USER-LEVEL NOTIFICATION CHANNEL
  // Catches all messages sent to this user across all conversations
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
          handleIncomingMessage(newRow);
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
  }, [currentUser?.id, handleIncomingMessage]);

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

    // 3. Immediately set an accurate active conversation placeholder with property context
    const propertyContext = {
      id: property.id,
      title: property.title,
      locality: property.locality,
      rent: property.rent,
      image_url:
        property.images?.find((img) => img.is_cover)?.thumbnail_url ||
        property.images?.find((img) => img.is_cover)?.url ||
        property.images?.[0]?.thumbnail_url ||
        property.images?.[0]?.url,
      is_available: property.availability_status === 'available',
    };

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
      property_context: propertyContext,
    };

    setActiveConversation(immediatePlaceholder);
    activeConversationRef.current = immediatePlaceholder;
    setMessages([]);
    setIsLoadingMessages(false);
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

      // Preserve property context on resolved conversation
      resolvedConv.property_context = propertyContext;

      // Synchronously set messages from cache or skeleton
      const cached = messagesCacheRef.current.get(resolvedConv.id);
      if (cached) {
        setMessages(cached);
        setIsLoadingMessages(false);
      } else {
        setMessages([]);
        setIsLoadingMessages(true);
      }

      // 5. Update active conversation with canonical DB record
      activeConversationRef.current = resolvedConv;
      setActiveConversation(resolvedConv);
      markConversationAsRead(resolvedConv.id);

      // Ensure conversation is in the left sidebar / thread list
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === resolvedConv.id);
        if (exists) {
          return prev.map((c) => (c.id === resolvedConv.id ? { ...c, ...resolvedConv, unread_count: 0 } : c));
        }
        return [resolvedConv, ...prev];
      });
      // The activeConversation?.id useEffect will automatically synchronize fresh messages safely
    } catch (err) {
      console.error('[ChatContext] Failed to resolve conversation for listing:', err);
      setIsLoadingMessages(false);
    }
  };

  // Backwards-compatible / generic chat opener
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

    if (currentUser.id === ownerId || (property.created_by && currentUser.id === property.created_by)) {
      return;
    }

    const propertyContext = {
      id: property.id,
      title: property.title,
      locality: property.locality,
      rent: property.rent,
    };

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
      property_context: propertyContext,
    };

    activeConversationRef.current = placeholder;
    setActiveConversation(placeholder);
    setMessages([]);
    setIsLoadingMessages(false);
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

      resolvedConv.property_context = propertyContext;

      const cached = messagesCacheRef.current.get(resolvedConv.id);
      if (cached) {
        setMessages(cached);
        setIsLoadingMessages(false);
      } else {
        setMessages([]);
        setIsLoadingMessages(true);
      }

      activeConversationRef.current = resolvedConv;
      setActiveConversation(resolvedConv);
      markConversationAsRead(resolvedConv.id);

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === resolvedConv.id);
        if (exists) {
          return prev.map((c) => (c.id === resolvedConv.id ? { ...c, ...resolvedConv, unread_count: 0 } : c));
        }
        return [resolvedConv, ...prev];
      });
      // The activeConversation?.id useEffect will automatically synchronize fresh messages safely
    } catch (err) {
      console.error('[ChatContext] Failed to resolve conversation in openChatWithContext:', err);
      setIsLoadingMessages(false);
    }
  };

  const selectConversation = useCallback(
    async (conv: Conversation) => {
      if (activeConversationRef.current?.id === conv.id) {
        return;
      }

      // Immediately invalidate any in-flight requests from the previous conversation
      fetchRequestIdRef.current += 1;

      // 1. Immediately switch the active conversation ref & state
      activeConversationRef.current = conv;
      setActiveConversation(conv);

      // 2. Synchronously clear or populate messages from cache in the SAME tick
      const cached = messagesCacheRef.current.get(conv.id);
      if (cached && cached.length > 0) {
        setMessages(cached);
        setIsLoadingMessages(false);
      } else {
        // Absolutely zero flash of previous conversation messages
        setMessages([]);
        setIsLoadingMessages(true);
      }

      // 3. Mark active conversation as read
      markConversationAsRead(conv.id);

      // Note: The activeConversation?.id useEffect will trigger and safely fetch fresh
      // messages over the network with fetchRequestIdRef validation, updating cache and UI.
    },
    [markConversationAsRead]
  );

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
            title: activeConversation.property_title || activeConversation.property_context?.title || '',
            locality: activeConversation.property_context?.locality || 'Prayagraj',
            rent: activeConversation.property_context?.rent || 0,
            image_url: activeConversation.property_context?.image_url,
          }
        : undefined,
    });

    // Record sent message ID in processed cache to avoid handling our own echo twice
    processedMessageIdsRef.current.add(sent.id);

    const targetId = isTempId ? (sent.conversation_id || activeConversation.id) : activeConversation.id;

    // If conversation was a placeholder, update to the newly assigned UUID
    if (isTempId && sent.conversation_id) {
      setActiveConversation((prev) => (prev ? { ...prev, id: sent.conversation_id } : prev));
      if (activeConversationRef.current) {
        activeConversationRef.current = { ...activeConversationRef.current, id: sent.conversation_id };
      }
    }

    // 1. Local state update (strictly verify that active conversation still points to targetId)
    if (
      activeConversationRef.current?.id === targetId ||
      (isTempId && activeConversationRef.current?.id === activeConversation.id)
    ) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    }

    // 2. Cache update
    const cachedList = messagesCacheRef.current.get(targetId) || [];
    if (!cachedList.some((m) => m.id === sent.id)) {
      messagesCacheRef.current.set(targetId, [...cachedList, sent]);
    }

    // 3. Peer WebSocket broadcast
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: sent,
      });
    }

    // 4. Update conversations list & move to top
    setConversations((prev) => {
      const found = prev.find((c) => c.id === targetId);
      if (found) {
        const updated = {
          ...found,
          id: sent.conversation_id || targetId,
          last_message: sent.text,
          last_message_time: sent.timestamp,
        };
        return [updated, ...prev.filter((c) => c.id !== targetId)];
      }
      return prev;
    });
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

    const isTempId = activeConversation.id.startsWith('temp-');

    const sent = await chatAndSafetyRepository.sendMessage({
      conversationId: isTempId ? undefined : activeConversation.id,
      senderId: currentUser.id,
      senderName: currentUser.full_name,
      receiverId: otherParticipantId,
      text: `📍 Exact Location Shared: ${locationShare.exact_address}`,
      propertyContext: activeConversation.property_id
        ? {
            id: activeConversation.property_id,
            title: activeConversation.property_title || activeConversation.property_context?.title || '',
            locality: activeConversation.property_context?.locality || 'Prayagraj',
            rent: activeConversation.property_context?.rent || 0,
            image_url: activeConversation.property_context?.image_url,
          }
        : undefined,
      locationShare,
    });

    processedMessageIdsRef.current.add(sent.id);

    const targetId = isTempId ? (sent.conversation_id || activeConversation.id) : activeConversation.id;

    if (
      activeConversationRef.current?.id === targetId ||
      activeConversationRef.current?.id === activeConversation.id
    ) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    }

    const cachedList = messagesCacheRef.current.get(targetId) || [];
    if (!cachedList.some((m) => m.id === sent.id)) {
      messagesCacheRef.current.set(targetId, [...cachedList, sent]);
    }

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
        isLoadingMessages,
        activeConversation,
        contactRequests,
        unreadCount,
        incomingToast,
        dismissToast,
        markConversationAsRead,
        requestNotificationPermission,
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

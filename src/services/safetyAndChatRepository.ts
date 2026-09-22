import { IChatRepository, ISafetyRepository } from './contracts';
import {
  Conversation,
  Message,
  ContactRequest,
  ContactRequestStatus,
  Report
} from '../types';
import { serverAuth } from './serverAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class ChatAndSafetyRepository implements IChatRepository, ISafetyRepository {
  private assertSupabaseClient() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
      );
    }
    return supabase;
  }

  // --- CHAT REPOSITORY ---

  async getConversations(userId: string): Promise<Conversation[]> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('conversations')
      .select(`
        *,
        profile_a:profiles!conversations_participant_a_fkey (id, full_name, avatar_url),
        profile_b:profiles!conversations_participant_b_fkey (id, full_name, avatar_url)
      `)
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('last_message_time', { ascending: false });

    if (error) {
      throw new Error(`Failed to load conversations: ${error.message}`);
    }

    return (data || []).map((c: any) => {
      const nameA = c.profile_a?.full_name || 'User A';
      const nameB = c.profile_b?.full_name || 'User B';
      const avatarA = c.profile_a?.avatar_url;
      const avatarB = c.profile_b?.avatar_url;

      return {
        id: c.id,
        participant_ids: [c.participant_a, c.participant_b],
        participant_names: {
          [c.participant_a]: nameA,
          [c.participant_b]: nameB,
        },
        participant_avatars: {
          [c.participant_a]: avatarA,
          [c.participant_b]: avatarB,
        },
        last_message: c.last_message || '',
        last_message_time: c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
        unread_count: 0,
        property_id: c.property_id,
        property_title: c.property_title,
      };
    });
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (id, full_name)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load messages: ${error.message}`);
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      sender_name: m.sender?.full_name || 'User',
      receiver_id: m.receiver_id,
      text: m.text,
      timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      is_read: Boolean(m.is_read),
      property_context: m.property_context,
    }));
  }

  async sendMessage(data: {
    conversationId?: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    text: string;
    propertyContext?: Message['property_context'];
    locationShare?: Message['location_share'];
  }): Promise<Message> {
    const client = this.assertSupabaseClient();

    let targetConvId = data.conversationId;

    if (!targetConvId) {
      // Find or create conversation
      const { data: existing, error: findErr } = await client
        .from('conversations')
        .select('id')
        .or(`and(participant_a.eq.${data.senderId},participant_b.eq.${data.receiverId}),and(participant_a.eq.${data.receiverId},participant_b.eq.${data.senderId})`)
        .maybeSingle();

      if (existing) {
        targetConvId = existing.id;
      } else {
        const { data: newConv, error: createErr } = await client
          .from('conversations')
          .insert({
            participant_a: data.senderId,
            participant_b: data.receiverId,
            property_id: data.propertyContext?.id,
            property_title: data.propertyContext?.title,
            last_message: data.text,
            last_message_time: new Date().toISOString(),
          })
          .select()
          .single();

        if (createErr || !newConv) {
          throw new Error(`Failed to initialize conversation: ${createErr?.message}`);
        }
        targetConvId = newConv.id;
      }
    }

    const { data: newMsg, error: msgErr } = await client
      .from('messages')
      .insert({
        conversation_id: targetConvId,
        sender_id: data.senderId,
        receiver_id: data.receiverId,
        text: data.text,
        property_context: data.propertyContext,
      })
      .select()
      .single();

    if (msgErr || !newMsg) {
      throw new Error(`Failed to send message: ${msgErr?.message}`);
    }

    // Update conversation last message timestamp
    await client
      .from('conversations')
      .update({
        last_message: data.text,
        last_message_time: new Date().toISOString(),
      })
      .eq('id', targetConvId);

    return {
      id: newMsg.id,
      conversation_id: targetConvId!,
      sender_id: data.senderId,
      sender_name: data.senderName,
      receiver_id: data.receiverId,
      text: data.text,
      timestamp: 'Just now',
      is_read: false,
      property_context: data.propertyContext,
      location_share: data.locationShare,
    };
  }

  // --- CONTACT REQUEST REPOSITORY ---

  async sendContactRequest(data: {
    propertyId?: string;
    propertyTitle?: string;
    requesterId: string;
    requesterName: string;
    requesterRole?: string;
    requesterPhone?: string;
    receiverId: string;
    receiverName: string;
    receiverRole?: string;
  }): Promise<ContactRequest> {
    const client = this.assertSupabaseClient();

    // Check existing
    const { data: existing } = await client
      .from('contact_requests')
      .select('*')
      .eq('property_id', data.propertyId)
      .eq('requester_id', data.requesterId)
      .eq('receiver_id', data.receiverId)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        property_id: existing.property_id,
        property_title: data.propertyTitle,
        requester_id: existing.requester_id,
        requester_name: data.requesterName,
        requester_role: (data.requesterRole as any) || 'member',
        requester_phone: data.requesterPhone,
        receiver_id: existing.receiver_id,
        receiver_name: data.receiverName,
        receiver_role: (data.receiverRole as any) || 'owner',
        status: existing.status as ContactRequestStatus,
        created_at: existing.created_at,
        updated_at: existing.updated_at,
      };
    }

    const { data: created, error } = await client
      .from('contact_requests')
      .insert({
        property_id: data.propertyId,
        requester_id: data.requesterId,
        receiver_id: data.receiverId,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !created) {
      throw new Error(`Failed to send contact request: ${error?.message}`);
    }

    return {
      id: created.id,
      property_id: created.property_id,
      property_title: data.propertyTitle,
      requester_id: created.requester_id,
      requester_name: data.requesterName,
      requester_role: (data.requesterRole as any) || 'member',
      requester_phone: data.requesterPhone,
      receiver_id: created.receiver_id,
      receiver_name: data.receiverName,
      receiver_role: (data.receiverRole as any) || 'owner',
      status: 'pending',
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  async updateContactRequestStatus(
    requestId: string,
    status: ContactRequestStatus
  ): Promise<ContactRequest> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('contact_requests')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select(`
        *,
        property:properties (id, title),
        requester:profiles!contact_requests_requester_id_fkey (id, full_name, phone_number),
        receiver:profiles!contact_requests_receiver_id_fkey (id, full_name, phone_number)
      `)
      .single();

    if (error || !data) {
      throw new Error(`Failed to update contact request status: ${error?.message}`);
    }

    return {
      id: data.id,
      property_id: data.property_id,
      property_title: data.property?.title,
      requester_id: data.requester_id,
      requester_name: data.requester?.full_name || 'Requester',
      requester_role: 'member',
      requester_phone: data.requester?.phone_number,
      receiver_id: data.receiver_id,
      receiver_name: data.receiver?.full_name || 'Owner',
      receiver_role: 'owner',
      receiver_phone: data.receiver?.phone_number,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async getContactRequests(userId: string): Promise<ContactRequest[]> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('contact_requests')
      .select(`
        *,
        property:properties (id, title),
        requester:profiles!contact_requests_requester_id_fkey (id, full_name, phone_number),
        receiver:profiles!contact_requests_receiver_id_fkey (id, full_name, phone_number)
      `)
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch contact requests: ${error.message}`);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      property_id: r.property_id,
      property_title: r.property?.title,
      requester_id: r.requester_id,
      requester_name: r.requester?.full_name || 'Student',
      requester_role: 'member',
      requester_phone: r.requester?.phone_number,
      receiver_id: r.receiver_id,
      receiver_name: r.receiver?.full_name || 'Owner',
      receiver_role: 'owner',
      receiver_phone: r.receiver?.phone_number,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async getContactRequestForPropertyAndRequester(
    propertyId: string,
    requesterId: string
  ): Promise<ContactRequest | null> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('contact_requests')
      .select('*')
      .eq('property_id', propertyId)
      .eq('requester_id', requesterId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      property_id: data.property_id,
      requester_id: data.requester_id,
      requester_name: 'Requester',
      requester_role: 'member',
      receiver_id: data.receiver_id,
      receiver_name: 'Owner',
      receiver_role: 'owner',
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  // --- SAFETY & MODERATION REPOSITORY ---

  async submitReport(data: {
    reporterId: string;
    reporterName: string;
    reportedEntityType: 'property' | 'user';
    reportedEntityId: string;
    reportedEntityName: string;
    reason: Report['reason'];
    notes?: string;
  }): Promise<Report> {
    const client = this.assertSupabaseClient();

    const { data: created, error } = await client
      .from('reports')
      .insert({
        reporter_id: data.reporterId,
        reported_entity_type: data.reportedEntityType,
        reported_entity_id: data.reportedEntityId,
        reported_entity_name: data.reportedEntityName,
        reason: data.reason,
        notes: data.notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !created) {
      throw new Error(`Failed to submit report: ${error?.message}`);
    }

    return {
      id: created.id,
      reporter_id: created.reporter_id,
      reporter_name: data.reporterName,
      reported_entity_type: created.reported_entity_type,
      reported_entity_id: created.reported_entity_id,
      reported_entity_name: created.reported_entity_name,
      reason: created.reason,
      notes: created.notes,
      status: created.status,
      created_at: created.created_at,
    };
  }

  async getReports(requestingUserId?: string): Promise<Report[]> {
    await serverAuth.assertSuperAdmin(requestingUserId);
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('reports')
      .select(`
        *,
        reporter:profiles!reports_reporter_id_fkey (id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch moderation reports: ${error.message}`);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      reporter_id: r.reporter_id,
      reporter_name: r.reporter?.full_name || 'Platform User',
      reported_entity_type: r.reported_entity_type,
      reported_entity_id: r.reported_entity_id,
      reported_entity_name: r.reported_entity_name,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      created_at: r.created_at,
    }));
  }

  async updateReportStatus(
    reportId: string,
    status: Report['status'],
    requestingUserId?: string
  ): Promise<Report> {
    await serverAuth.assertSuperAdmin(requestingUserId);
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('reports')
      .update({ status })
      .eq('id', reportId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update report status: ${error?.message}`);
    }

    return {
      id: data.id,
      reporter_id: data.reporter_id,
      reporter_name: 'Platform User',
      reported_entity_type: data.reported_entity_type,
      reported_entity_id: data.reported_entity_id,
      reported_entity_name: data.reported_entity_name,
      reason: data.reason,
      notes: data.notes,
      status: data.status,
      created_at: data.created_at,
    };
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    const client = this.assertSupabaseClient();
    try {
      // In Supabase, flag profile or record moderation action
      await client.from('profiles').update({ is_blocked: true }).eq('id', blockedId);
      return true;
    } catch {
      return false;
    }
  }

  async isUserBlocked(blockerId: string, targetId: string): Promise<boolean> {
    const client = this.assertSupabaseClient();
    try {
      const { data } = await client.from('profiles').select('is_blocked').eq('id', targetId).maybeSingle();
      return Boolean(data?.is_blocked);
    } catch {
      return false;
    }
  }
}

export const chatAndSafetyRepository = new ChatAndSafetyRepository();
export const safetyRepository = chatAndSafetyRepository;
export const chatRepository = chatAndSafetyRepository;

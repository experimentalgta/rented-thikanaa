import { IChatRepository, ISafetyRepository } from './contracts';
import {
  Conversation,
  Message,
  ContactRequest,
  ContactRequestStatus,
  Report
} from '../types';

const CHAT_STORAGE_KEY = 'prayag_living_messages_v1';
const CONV_STORAGE_KEY = 'prayag_living_conversations_v1';
const CONTACT_REQ_STORAGE_KEY = 'prayag_living_contact_requests_v1';
const REPORTS_STORAGE_KEY = 'prayag_living_reports_v1';
const BLOCKS_STORAGE_KEY = 'prayag_living_blocks_v1';

// Initial seed conversations
const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    participant_ids: ['user-stud-1', 'owner-101'],
    participant_names: {
      'user-stud-1': 'Ankit Tiwari',
      'owner-101': 'Pandey Nilayam Residency (Katra)',
    },
    participant_avatars: {
      'user-stud-1': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
      'owner-101': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    },
    last_message: 'Yes, double sharing room with cooler is available on 2nd floor.',
    last_message_time: '10:45 AM',
    unread_count: 1,
    property_id: 'prop-katra-1',
    property_title: 'Sunrise Boys PG & Study Hub – Katra',
  },
  {
    id: 'conv-2',
    participant_ids: ['user-stud-1', 'owner-104'],
    participant_names: {
      'user-stud-1': 'Ankit Tiwari',
      'owner-104': 'Anand Heritage Stays (Mumfordganj)',
    },
    participant_avatars: {
      'user-stud-1': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
      'owner-104': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    },
    last_message: 'Please feel free to visit today between 4 PM to 7 PM.',
    last_message_time: 'Yesterday',
    unread_count: 0,
    property_id: 'prop-mumford-1',
    property_title: 'Silent Aspirant Studio Rooms – Mumfordganj',
  }
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-101',
    conversation_id: 'conv-1',
    sender_id: 'user-stud-1',
    sender_name: 'Ankit Tiwari',
    receiver_id: 'owner-101',
    text: 'Namaste Pandey ji, I saw your Sunrise Boys PG in Katra on PrayagLiving. Is double sharing available for immediate move-in?',
    timestamp: '10:30 AM',
    is_read: true,
    property_context: {
      id: 'prop-katra-1',
      title: 'Sunrise Boys PG & Study Hub – Katra',
      locality: 'Katra',
      rent: 6200,
    },
  },
  {
    id: 'msg-102',
    conversation_id: 'conv-1',
    sender_id: 'owner-101',
    sender_name: 'Pandey Nilayam Residency',
    receiver_id: 'user-stud-1',
    text: 'Yes, double sharing room with cooler is available on 2nd floor. Mess is running full time. When would you like to come for a visit?',
    timestamp: '10:45 AM',
    is_read: false,
    property_context: {
      id: 'prop-katra-1',
      title: 'Sunrise Boys PG & Study Hub – Katra',
      locality: 'Katra',
      rent: 6200,
    },
  },
];

const INITIAL_CONTACT_REQUESTS: ContactRequest[] = [
  {
    id: 'req-1',
    property_id: 'prop-katra-1',
    property_title: 'Sunrise Boys PG & Study Hub – Katra',
    requester_id: 'user-stud-1',
    requester_name: 'Ankit Tiwari',
    requester_role: 'student',
    requester_phone: '+91 98394 55123',
    receiver_id: 'owner-101',
    receiver_name: 'Pandey Nilayam Residency',
    receiver_role: 'owner',
    receiver_phone: '+91 94152 38472',
    status: 'pending',
    created_at: '2026-09-10T10:30:00Z',
    updated_at: '2026-09-10T10:30:00Z',
  }
];

const INITIAL_REPORTS: Report[] = [
  {
    id: 'rep-1',
    reporter_id: 'user-stud-2',
    reporter_name: 'Pooja Srivastava',
    reported_entity_type: 'property',
    reported_entity_id: 'prop-sample-fake',
    reported_entity_name: 'Suspicious 1BHK Katra (Reported)',
    reason: 'wrong_information',
    notes: 'Price posted was ₹1500 but on visiting owner asked ₹9000 and demanded token money upfront.',
    status: 'pending',
    created_at: '2026-09-08T14:20:00Z',
  }
];

export class ChatAndSafetyRepository implements IChatRepository, ISafetyRepository {
  // --- CHAT REPOSITORY ---

  private getStoredConversations(): Conversation[] {
    try {
      const stored = localStorage.getItem(CONV_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn(e);
    }
    try {
      localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(INITIAL_CONVERSATIONS));
    } catch (e) {}
    return [...INITIAL_CONVERSATIONS];
  }

  private getStoredMessages(): Message[] {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn(e);
    }
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(INITIAL_MESSAGES));
    } catch (e) {}
    return [...INITIAL_MESSAGES];
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const all = this.getStoredConversations();
    return all.filter((c) => c.participant_ids.includes(userId));
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const all = this.getStoredMessages();
    return all.filter((m) => m.conversation_id === conversationId);
  }

  async sendMessage(data: {
    conversationId?: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    text: string;
    propertyContext?: Message['property_context'];
  }): Promise<Message> {
    const conversations = this.getStoredConversations();
    const messages = this.getStoredMessages();

    let targetConvId = data.conversationId;

    if (!targetConvId) {
      // Find or create conversation
      const existing = conversations.find(
        (c) =>
          c.participant_ids.includes(data.senderId) &&
          c.participant_ids.includes(data.receiverId) &&
          (!data.propertyContext?.id || c.property_id === data.propertyContext.id)
      );

      if (existing) {
        targetConvId = existing.id;
      } else {
        targetConvId = `conv-${Date.now()}`;
        const newConv: Conversation = {
          id: targetConvId,
          participant_ids: [data.senderId, data.receiverId],
          participant_names: {
            [data.senderId]: data.senderName,
            [data.receiverId]: data.propertyContext?.title || 'User',
          },
          last_message: data.text,
          last_message_time: 'Just now',
          unread_count: 0,
          property_id: data.propertyContext?.id,
          property_title: data.propertyContext?.title,
        };
        conversations.unshift(newConv);
      }
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversation_id: targetConvId,
      sender_id: data.senderId,
      sender_name: data.senderName,
      receiver_id: data.receiverId,
      text: data.text,
      timestamp: 'Just now',
      is_read: false,
      property_context: data.propertyContext,
    };

    messages.push(newMessage);

    // Update conversation metadata
    const convIndex = conversations.findIndex((c) => c.id === targetConvId);
    if (convIndex !== -1) {
      conversations[convIndex].last_message = data.text;
      conversations[convIndex].last_message_time = 'Just now';
    }

    localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(conversations));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));

    return newMessage;
  }

  // --- CONTACT REQUEST REPOSITORY ---

  private getStoredContactRequests(): ContactRequest[] {
    try {
      const stored = localStorage.getItem(CONTACT_REQ_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn(e);
    }
    try {
      localStorage.setItem(CONTACT_REQ_STORAGE_KEY, JSON.stringify(INITIAL_CONTACT_REQUESTS));
    } catch (e) {}
    return [...INITIAL_CONTACT_REQUESTS];
  }

  async sendContactRequest(data: {
    propertyId?: string;
    propertyTitle?: string;
    requesterId: string;
    requesterName: string;
    requesterRole: 'student' | 'owner';
    requesterPhone?: string;
    receiverId: string;
    receiverName: string;
    receiverRole: 'student' | 'owner';
  }): Promise<ContactRequest> {
    const all = this.getStoredContactRequests();

    // Check if duplicate pending
    const existing = all.find(
      (r) =>
        r.requester_id === data.requesterId &&
        r.receiver_id === data.receiverId &&
        r.property_id === data.propertyId
    );
    if (existing) {
      return existing;
    }

    const newReq: ContactRequest = {
      id: `req-${Date.now()}`,
      property_id: data.propertyId,
      property_title: data.propertyTitle,
      requester_id: data.requesterId,
      requester_name: data.requesterName,
      requester_role: data.requesterRole,
      requester_phone: data.requesterPhone || '+91 98394 55123',
      receiver_id: data.receiverId,
      receiver_name: data.receiverName,
      receiver_role: data.receiverRole,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    all.unshift(newReq);
    localStorage.setItem(CONTACT_REQ_STORAGE_KEY, JSON.stringify(all));
    return newReq;
  }

  async updateContactRequestStatus(
    requestId: string,
    status: ContactRequestStatus
  ): Promise<ContactRequest> {
    const all = this.getStoredContactRequests();
    const index = all.findIndex((r) => r.id === requestId);
    if (index === -1) throw new Error(`Contact request ${requestId} not found`);

    all[index].status = status;
    all[index].updated_at = new Date().toISOString();

    localStorage.setItem(CONTACT_REQ_STORAGE_KEY, JSON.stringify(all));
    return all[index];
  }

  async getContactRequests(userId: string): Promise<ContactRequest[]> {
    const all = this.getStoredContactRequests();
    return all.filter((r) => r.requester_id === userId || r.receiver_id === userId);
  }

  async getContactRequestForPropertyAndRequester(
    propertyId: string,
    requesterId: string
  ): Promise<ContactRequest | null> {
    const all = this.getStoredContactRequests();
    const found = all.find(
      (r) => r.property_id === propertyId && r.requester_id === requesterId
    );
    return found || null;
  }

  // --- SAFETY & MODERATION REPOSITORY ---

  private getStoredReports(): Report[] {
    try {
      const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn(e);
    }
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(INITIAL_REPORTS));
    } catch (e) {}
    return [...INITIAL_REPORTS];
  }

  async submitReport(data: {
    reporterId: string;
    reporterName: string;
    reportedEntityType: 'property' | 'user';
    reportedEntityId: string;
    reportedEntityName: string;
    reason: Report['reason'];
    notes?: string;
  }): Promise<Report> {
    const reports = this.getStoredReports();
    const newReport: Report = {
      id: `rep-${Date.now()}`,
      reporter_id: data.reporterId,
      reporter_name: data.reporterName,
      reported_entity_type: data.reportedEntityType,
      reported_entity_id: data.reportedEntityId,
      reported_entity_name: data.reportedEntityName,
      reason: data.reason,
      notes: data.notes,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    reports.unshift(newReport);
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    return newReport;
  }

  async getReports(): Promise<Report[]> {
    return this.getStoredReports();
  }

  async updateReportStatus(reportId: string, status: Report['status']): Promise<Report> {
    const reports = this.getStoredReports();
    const index = reports.findIndex((r) => r.id === reportId);
    if (index === -1) throw new Error(`Report ${reportId} not found`);

    reports[index].status = status;
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    return reports[index];
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    try {
      const stored = localStorage.getItem(BLOCKS_STORAGE_KEY);
      const blocks: { blockerId: string; blockedId: string }[] = stored ? JSON.parse(stored) : [];
      blocks.push({ blockerId, blockedId });
      localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(blocks));
      return true;
    } catch (e) {
      return false;
    }
  }

  async isUserBlocked(blockerId: string, targetId: string): Promise<boolean> {
    try {
      const stored = localStorage.getItem(BLOCKS_STORAGE_KEY);
      if (!stored) return false;
      const blocks: { blockerId: string; blockedId: string }[] = JSON.parse(stored);
      return blocks.some((b) => b.blockerId === blockerId && b.blockedId === targetId);
    } catch (e) {
      return false;
    }
  }
}

export const chatAndSafetyRepository = new ChatAndSafetyRepository();

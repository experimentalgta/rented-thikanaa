import {
  Property,
  PropertySearchParams,
  SearchResultSummary,
  StudentProfile,
  Conversation,
  Message,
  ContactRequest,
  ContactRequestStatus,
  Report,
  StudentLifestyle
} from '../../types';

export interface IPropertyRepository {
  searchProperties(params: PropertySearchParams, currentUserId?: string): Promise<SearchResultSummary>;
  getPropertyById(id: string, currentUserId?: string): Promise<Property | null>;
  createProperty(data: Partial<Property>): Promise<Property>;
  updateProperty(id: string, updates: Partial<Property>): Promise<Property>;
  getPropertiesByOwner(ownerId: string): Promise<Property[]>;
  getAllPropertiesAdmin(): Promise<Property[]>;
  updatePropertyStatus(id: string, status: Property['availability_status']): Promise<Property>;
  verifyProperty(id: string, badge: Property['verification_badge']): Promise<Property>;
}

export interface IRoommateRepository {
  getRoommates(filters?: {
    gender?: string;
    locality?: string;
    maxBudget?: number;
    dietary?: string;
    smoking?: string;
  }, referenceProfile?: Partial<StudentProfile>): Promise<StudentProfile[]>;
  getRoommateById(id: string): Promise<StudentProfile | null>;
  calculateCompatibility(
    profileA: Partial<StudentProfile>,
    profileB: Partial<StudentProfile>
  ): { score: number; breakdown: { factor: string; matched: boolean; description: string }[] };
}

export interface IChatRepository {
  getConversations(userId: string): Promise<Conversation[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(data: {
    conversationId: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    text: string;
    propertyContext?: Message['property_context'];
  }): Promise<Message>;
  sendContactRequest(data: {
    propertyId?: string;
    propertyTitle?: string;
    requesterId: string;
    requesterName: string;
    requesterRole: 'student' | 'owner';
    requesterPhone?: string;
    receiverId: string;
    receiverName: string;
    receiverRole: 'student' | 'owner';
  }): Promise<ContactRequest>;
  updateContactRequestStatus(requestId: string, status: ContactRequestStatus): Promise<ContactRequest>;
  getContactRequests(userId: string): Promise<ContactRequest[]>;
  getContactRequestForPropertyAndRequester(propertyId: string, requesterId: string): Promise<ContactRequest | null>;
}

export interface ISafetyRepository {
  submitReport(report: {
    reporterId: string;
    reporterName: string;
    reportedEntityType: 'property' | 'user';
    reportedEntityId: string;
    reportedEntityName: string;
    reason: Report['reason'];
    notes?: string;
  }): Promise<Report>;
  getReports(): Promise<Report[]>;
  updateReportStatus(reportId: string, status: Report['status']): Promise<Report>;
  blockUser(blockerId: string, blockedId: string): Promise<boolean>;
  isUserBlocked(blockerId: string, targetId: string): Promise<boolean>;
}

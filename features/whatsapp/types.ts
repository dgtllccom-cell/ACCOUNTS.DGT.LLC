// features/whatsapp/types.ts
// Shared TypeScript types for the WhatsApp Team Inbox module.

export type WhatsAppAccountScope = "super_admin" | "country" | "country_branch" | "city_branch";
export type ConversationStatus = "open" | "assigned" | "resolved" | "spam";
export type MessageDirection = "inbound" | "outbound" | "internal_note";
export type MessageType = "text" | "image" | "document" | "audio" | "video" | "sticker" | "location" | "contact" | "template" | "reaction" | "unknown";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type WhatsAppAccount = {
  id: string;
  scope: WhatsAppAccountScope;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  isActive: boolean;
  isDefault: boolean;
  webhookRegistered: boolean;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  country?: { id: string; name: string } | null;
  countryBranch?: { id: string; name: string } | null;
  cityBranch?: { id: string; name: string; cityName: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppContact = {
  id: string;
  phoneNumber: string;
  waProfileName: string | null;
  displayName: string | null;
  customerId: string | null;
  labels: string[];
  notes: string | null;
  isBlocked: boolean;
  lastSeenAt: string | null;
};

export type WhatsAppConversation = {
  id: string;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageDir: MessageDirection | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  whatsappAccount: { id: string; displayName: string; phoneNumber: string } | null;
  contact: WhatsAppContact | null;
  assignedUser: { id: string; fullName: string } | null;
  country: { id: string; name: string } | null;
  cityBranch: { id: string; name: string; cityName: string } | null;
};

export type WhatsAppMessage = {
  id: string;
  direction: MessageDirection;
  messageType: MessageType;
  status: MessageStatus;
  body: string | null;
  templateName: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  mediaSizeBytes: number | null;
  locationLat: number | null;
  locationLng: number | null;
  locationName: string | null;
  externalMessageId: string | null;
  contextMessageId: string | null;
  senderPhone: string | null;
  senderUserId: string | null;
  senderProfile: { id: string; fullName: string } | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  media?: Array<{
    id: string;
    storagePath: string;
    publicUrl: string | null;
    mimeType: string | null;
    filename: string | null;
    durationSecs: number | null;
  }>;
};

export type ErpCustomer = {
  id: string;
  customerName: string;
  companyName: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  countryId: string;
  notes: string | null;
  country?: { name: string };
};

export type WhatsAppActivity = {
  id: string;
  eventType: string;
  eventData: Record<string, unknown>;
  actorName: string | null;
  createdAt: string;
};

export type ConversationDetail = {
  conversation: WhatsAppConversation & {
    windowExpiresAt: string | null;
    linkedModule: string | null;
    linkedDocumentNo: string | null;
  };
  erpCustomer: ErpCustomer | null;
  activity: WhatsAppActivity[];
};

export type SendMessagePayload =
  | { type: "text"; body: string }
  | { type: "internal_note"; body: string }
  | { type: "template"; templateName: string; templateParams?: string[]; language?: string }
  | { type: "image"; mediaUrl: string; caption?: string }
  | { type: "document"; mediaUrl: string; filename: string; caption?: string };

export type ConversationFilters = {
  status?: ConversationStatus | "all";
  accountId?: string;
  assignedUserId?: string;
  countryId?: string;
  cityBranchId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

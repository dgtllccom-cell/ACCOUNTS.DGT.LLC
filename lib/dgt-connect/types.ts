import type { SupportedLanguage } from "@/lib/i18n/languages";

export const DGT_LANGS: SupportedLanguage[] = ["en", "ur", "ps", "fa", "ar"];

export type DgtPresenceStatus = "online" | "away" | "offline";

export type DgtDirectoryUser = {
  id: string;
  name: string;
  role: string | null;
  lang: SupportedLanguage;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  presence: DgtPresenceStatus;
  lastSeenAt: string | null;
};

export type DgtDirectoryBranch = {
  id: string;            // country_branch_id or city_branch_id
  kind: "country_branch" | "city_branch";
  name: string;
  countryId: string;
  users: DgtDirectoryUser[];
};

export type DgtDirectoryCountry = {
  id: string;
  name: string;
  branches: DgtDirectoryBranch[];
  /** users assigned at country level (no branch) */
  countryUsers: DgtDirectoryUser[];
};

export type DgtDirectory = {
  scopeLabel: string;
  self: { id: string; name: string; lang: SupportedLanguage };
  countries: DgtDirectoryCountry[];
  /** reachable users with no country assignment (e.g. global super-admins) */
  globalUsers: DgtDirectoryUser[];
};

export type DgtMessageKind = "text" | "attachment" | "record_share" | "system";

export type DgtAttachment = {
  name: string;
  mime: string;
  size: number;
  dataUrl?: string;
  url?: string;
};

export type DgtSharedRecord = {
  module: string;
  id: string;
  label: string;
  route?: string;
  summary?: string;
};

export type DgtMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  kind: DgtMessageKind;
  body: string;
  bodyLang: SupportedLanguage;
  attachment: DgtAttachment | null;
  sharedRecord: DgtSharedRecord | null;
  replyToId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  /** delivered/read across the other participants */
  deliveredCount: number;
  readCount: number;
  /** translated view for the requesting viewer, when body_lang != viewer lang */
  translated?: { lang: SupportedLanguage; text: string; engine: string } | null;
};

export type DgtParticipant = {
  userId: string;
  name: string;
  role: "member" | "admin";
  lang: SupportedLanguage;
  presence: DgtPresenceStatus;
  lastReadAt: string | null;
};

export type DgtConversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  /** for a direct chat: the other person's display name */
  displayName: string;
  participants: DgtParticipant[];
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
  /** the other user's presence for a direct chat */
  peerPresence: DgtPresenceStatus | null;
  peerId: string | null;
};

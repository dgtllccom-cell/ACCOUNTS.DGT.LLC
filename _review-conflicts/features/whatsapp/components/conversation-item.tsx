"use client";

import { formatDistanceToNow } from "../utils/date";
import { Phone, FileText, Image, Mic, Video } from "lucide-react";
import type { WhatsAppConversation, MessageType } from "../types";
import { StatusBadge } from "./status-badge";

type Props = {
  conversation: WhatsAppConversation;
  isActive: boolean;
  onClick: () => void;
};

function MessagePreviewIcon({ type }: { type: MessageType | null }) {
  if (!type || type === "text") return null;
  const icons: Partial<Record<MessageType, React.ReactNode>> = {
    image: <Image className="h-3 w-3 text-muted-foreground" />,
    document: <FileText className="h-3 w-3 text-muted-foreground" />,
    audio: <Mic className="h-3 w-3 text-muted-foreground" />,
    video: <Video className="h-3 w-3 text-muted-foreground" />
  };
  return icons[type] ?? null;
}

function getContactLabel(conversation: WhatsAppConversation): string {
  const c = conversation.contact;
  if (!c) return "Unknown";
  return c.displayName ?? c.waProfileName ?? c.phoneNumber ?? "Unknown";
}

function getInitials(label: string): string {
  return label
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500"
];

function avatarColor(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function ConversationItem({ conversation: conv, isActive, onClick }: Props) {
  const label = getContactLabel(conv);
  const initials = getInitials(label);
  const color = avatarColor(label);
  const hasUnread = conv.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2.5 text-start transition-all duration-150 ${
        isActive
          ? "bg-[#25D366]/10 ring-1 ring-[#25D366]/20"
          : "hover:bg-accent/60"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className={`relative flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-white text-[11px] font-bold ${color}`}>
          {initials}
          {/* Online indicator for unread */}
          {hasUnread && (
            <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-[#25D366]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`truncate text-xs ${hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
              {label}
            </span>
            <span className="flex-shrink-0 text-[10px] text-muted-foreground">
              {conv.lastMessageAt ? formatDistanceToNow(conv.lastMessageAt) : ""}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {conv.lastMessageDir === "outbound" && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">You:</span>
              )}
              <MessagePreviewIcon type={null} />
              <span className={`truncate text-[11px] ${hasUnread ? "text-foreground/80" : "text-muted-foreground"}`}>
                {conv.lastMessageText ?? ""}
              </span>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1">
              {hasUnread && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[9px] font-bold text-white">
                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                </span>
              )}
              <StatusBadge status={conv.status} tiny />
            </div>
          </div>

          {/* Branch info */}
          {conv.cityBranch && (
            <p className="mt-0.5 truncate text-[9px] text-muted-foreground/60">
              {conv.cityBranch.cityName} · {conv.whatsappAccount?.displayName ?? ""}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

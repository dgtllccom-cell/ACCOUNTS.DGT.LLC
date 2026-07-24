"use client";

import { formatDateTime } from "../utils/date";
import { Check, CheckCheck, Clock, AlertCircle, FileText, Mic, Image, Video, MapPin, StickerIcon } from "lucide-react";
import type { WhatsAppMessage } from "../types";
import { cn } from "@/lib/utils";

type Props = {
  message: WhatsAppMessage;
  prevMessage: WhatsAppMessage | null;
};

function DeliveryIcon({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-400" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground/60" />;
  if (status === "sent") return <Check className="h-3 w-3 text-muted-foreground/60" />;
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-destructive" />;
  return <Clock className="h-3 w-3 text-muted-foreground/40" />;
}

function MediaPreview({ message }: { message: WhatsAppMessage }) {
  const type = message.messageType;
  if (type === "image") {
    if (message.mediaUrl) {
      return (
        <div className="mb-1 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt="Image"
            className="max-h-48 max-w-[240px] rounded-lg object-cover"
          />
        </div>
      );
    }
    return (
      <div className="mb-1 flex h-24 w-40 items-center justify-center rounded-lg bg-muted">
        <Image className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (type === "document") {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-2.5 py-2">
        <FileText className="h-5 w-5 flex-shrink-0" />
        <span className="truncate text-[11px]">{message.mediaFilename ?? "Document"}</span>
      </div>
    );
  }
  if (type === "audio") {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-2.5 py-2">
        <Mic className="h-4 w-4 flex-shrink-0" />
        <div className="flex flex-1 gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-0.5 rounded-full bg-current opacity-40" style={{ height: `${4 + Math.random() * 12}px` }} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{message.mediaSizeBytes ? `${Math.ceil(message.mediaSizeBytes / 1024)}KB` : ""}</span>
      </div>
    );
  }
  if (type === "video") {
    return (
      <div className="mb-1 flex h-24 w-40 items-center justify-center rounded-lg bg-muted">
        <Video className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (type === "location") {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-2.5 py-2">
        <MapPin className="h-4 w-4" />
        <span className="text-[11px]">{message.locationName ?? `${message.locationLat}, ${message.locationLng}`}</span>
      </div>
    );
  }
  return null;
}

function shouldShowDate(message: WhatsAppMessage, prevMessage: WhatsAppMessage | null): boolean {
  if (!prevMessage) return true;
  const d1 = new Date(message.createdAt).toDateString();
  const d2 = new Date(prevMessage.createdAt).toDateString();
  return d1 !== d2;
}

export function MessageBubble({ message: msg, prevMessage }: Props) {
  const isOutbound = msg.direction === "outbound";
  const isNote = msg.direction === "internal_note";
  const showDate = shouldShowDate(msg, prevMessage);

  return (
    <>
      {showDate && (
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] text-muted-foreground shadow-sm">
            {formatDateTime(msg.createdAt, "MMMM d, yyyy")}
          </span>
        </div>
      )}

      <div
        className={cn(
          "flex",
          isNote ? "justify-center" : isOutbound ? "justify-end" : "justify-start"
        )}
      >
        {/* Internal note */}
        {isNote ? (
          <div className="max-w-[70%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-60">Internal Note</p>
            <p className="whitespace-pre-wrap">{msg.body}</p>
            <p className="mt-1 text-[9px] text-right opacity-50">
              {msg.senderProfile?.fullName ?? ""}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "group relative max-w-[72%] rounded-2xl px-3 py-2 shadow-sm",
              isOutbound
                ? "rounded-tr-sm bg-[#d9fdd3] text-gray-900 dark:bg-[#025c4c] dark:text-gray-100"
                : "rounded-tl-sm bg-white text-gray-900 dark:bg-[#1f2c34] dark:text-gray-100"
            )}
          >
            {/* Quoted/replied message context */}
            {msg.contextMessageId && (
              <div className="mb-1.5 rounded-md border-s-2 border-[#25D366] bg-black/5 ps-2 py-1 text-[10px] text-muted-foreground">
                Replied to message
              </div>
            )}

            <MediaPreview message={msg} />

            {msg.body && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
            )}

            {!msg.body && !["image", "document", "audio", "video", "location"].includes(msg.messageType) && (
              <p className="italic text-xs text-muted-foreground">[{msg.messageType}]</p>
            )}

            {/* Time + delivery status */}
            <div className="mt-1 flex items-center justify-end gap-1">
              <span className="text-[10px] text-muted-foreground/70">
                {msg.sentAt ? formatDateTime(msg.sentAt, "HH:mm") : formatDateTime(msg.createdAt, "HH:mm")}
              </span>
              {isOutbound && <DeliveryIcon status={msg.status} />}
            </div>

            {/* WhatsApp tail */}
            <div
              className={cn(
                "absolute top-0 h-3 w-2",
                isOutbound
                  ? "-end-1.5 text-[#d9fdd3] dark:text-[#025c4c]"
                  : "-start-1.5 text-white dark:text-[#1f2c34]"
              )}
            >
              <svg viewBox="0 0 8 12" className="h-full w-full fill-current">
                {isOutbound
                  ? <path d="M8 0 L8 12 L0 0 Z" />
                  : <path d="M0 0 L0 12 L8 0 Z" />
                }
              </svg>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

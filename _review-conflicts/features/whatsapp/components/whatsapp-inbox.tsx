"use client";

import { useState, useCallback, useEffect } from "react";
import { MessageSquare, RefreshCw, Settings, Plus } from "lucide-react";
import Link from "next/link";
import { ConversationList } from "./conversation-list";
import { ChatPanel } from "./chat-panel";
import { ContactPanel } from "./contact-panel";
import { useConversations } from "../hooks/use-conversations";
import { useMessages } from "../hooks/use-messages";
import { useWhatsAppRealtime } from "../hooks/use-realtime";
import { fetchWhatsAppAccounts, startNewConversation } from "../api";
import type { WhatsAppAccount, WhatsAppConversation } from "../types";
import type { ErpSession } from "@/lib/auth/session";

type Props = {
  session: ErpSession;
};

export function WhatsAppInbox({ session }: Props) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(true);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);

  useEffect(() => {
    fetchWhatsAppAccounts()
      .then(setAccounts)
      .catch((err) => console.error("Error loading accounts:", err));
  }, []);

  async function handleNewChat() {
    const phone = prompt("Enter customer phone number (with country code, e.g. +971501234567):");
    if (!phone) return;
    try {
      const res = await startNewConversation(phone);
      setActiveConversationId(res.conversationId);
      refreshConversations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start new conversation");
    }
  }

  const {
    conversations,
    filters,
    isLoading: convLoading,
    applyFilters,
    refresh: refreshConversations,
    setConversations
  } = useConversations({ status: "all", limit: 25 });

  const {
    messages,
    detail,
    isLoading: msgLoading,
    isSending,
    error: msgError,
    send,
    loadMore
  } = useMessages(activeConversationId);

  // Live updates via Supabase Realtime
  const handleNewMessage = useCallback(
    (conversationId: string) => {
      // Update unread count in conversation list optimistically
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, unreadCount: c.id === activeConversationId ? 0 : c.unreadCount + 1 }
            : c
        )
      );
      // If active conversation, reload messages
      if (conversationId === activeConversationId) {
        // Trigger refresh via key change is handled by useMessages's useEffect
        refreshConversations();
      } else {
        refreshConversations();
      }
    },
    [activeConversationId, setConversations, refreshConversations]
  );

  useWhatsAppRealtime({
    onNewMessage: handleNewMessage,
    onConversationUpdate: () => refreshConversations(),
    cityBranchIds: session.cityBranchIds
  });

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[hsl(var(--background))]">
      {/* ── Left Panel: Conversation List ── */}
      <div className="flex w-[320px] flex-shrink-0 flex-col border-e border-border/50 bg-card/80 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]/15">
              <MessageSquare className="h-4 w-4 text-[#25D366]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">WhatsApp Inbox</h1>
              <p className="text-[10px] text-muted-foreground">
                {conversations.filter((c) => c.status === "open").length} open
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              title="New Chat"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => refreshConversations()}
              title="Refresh"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${convLoading ? "animate-spin" : ""}`} />
            </button>
            <Link
              href="/dashboard/messages/whatsapp/setup"
              title="Manage WhatsApp Accounts"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          filters={filters}
          isLoading={convLoading}
          onSelect={(id) => setActiveConversationId(id)}
          onFilterChange={applyFilters}
          session={session}
          accounts={accounts}
        />
      </div>

      {/* ── Center Panel: Chat ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {activeConversationId && detail ? (
          <ChatPanel
            conversation={activeConversation}
            detail={detail}
            messages={messages}
            isLoading={msgLoading}
            isSending={isSending}
            error={msgError}
            onSend={send}
            onLoadMore={loadMore}
            onToggleContact={() => setShowContact((v) => !v)}
            showContact={showContact}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#25D366]/10">
              <MessageSquare className="h-10 w-10 text-[#25D366]/60" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a conversation from the left panel to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel: Contact / ERP Info ── */}
      {activeConversationId && detail && showContact && (
        <div className="w-[280px] flex-shrink-0 border-s border-border/50 bg-card/80 backdrop-blur-sm overflow-y-auto">
          <ContactPanel detail={detail} />
        </div>
      )}
    </div>
  );
}

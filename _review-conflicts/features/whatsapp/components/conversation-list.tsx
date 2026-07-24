"use client";

import { useRef, useState } from "react";
import { Search, Filter, ChevronDown } from "lucide-react";
import type { WhatsAppConversation, ConversationFilters, ConversationStatus, WhatsAppAccount } from "../types";
import { ConversationItem } from "./conversation-item";
import { FiltersBar } from "./filters-bar";
import type { ErpSession } from "@/lib/auth/session";

type Props = {
  conversations: WhatsAppConversation[];
  activeId: string | null;
  filters: ConversationFilters;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onFilterChange: (filters: Partial<ConversationFilters>) => void;
  session: ErpSession;
  accounts: WhatsAppAccount[];
};

const STATUS_TABS: { label: string; value: ConversationStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Assigned", value: "assigned" },
  { label: "Resolved", value: "resolved" }
];

export function ConversationList({
  conversations,
  activeId,
  filters,
  isLoading,
  onSelect,
  onFilterChange,
  session,
  accounts
}: Props) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onFilterChange({ search: value });
    }, 350);
  }

  const filtered = search
    ? conversations.filter((c) => {
        const s = search.toLowerCase();
        const contact = c.contact;
        return (
          contact?.displayName?.toLowerCase().includes(s) ||
          contact?.waProfileName?.toLowerCase().includes(s) ||
          contact?.phoneNumber?.includes(s) ||
          c.lastMessageText?.toLowerCase().includes(s)
        );
      })
    : conversations;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-border/40">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background/60 ps-8 pe-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#25D366]/50 focus:border-[#25D366]/50 transition-colors"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex border-b border-border/40">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange({ status: tab.value })}
            className={`flex-1 py-2 text-[10px] font-medium transition-colors border-b-2 ${
              filters.status === tab.value || (!filters.status && tab.value === "all")
                ? "border-[#25D366] text-[#25D366]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.value !== "all" && (
              <span className="ms-1 text-[9px] opacity-70">
                ({conversations.filter((c) => c.status === tab.value).length})
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`px-2 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors border-b-2 ${showFilters ? "border-[#25D366] text-[#25D366]" : "border-transparent"}`}
          title="Advanced filters"
        >
          <Filter className="h-3 w-3" />
        </button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <FiltersBar filters={filters} onFilterChange={onFilterChange} session={session} accounts={accounts} />
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#25D366] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <p className="text-xs text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-1">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onClick={() => onSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

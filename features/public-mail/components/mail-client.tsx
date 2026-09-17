"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, HardDrive, RefreshCw } from "lucide-react";
import { MailNavbar } from "./mail-navbar";
import { MailSidebar } from "./mail-sidebar";
import { MailList } from "./mail-list";
import { MailView } from "./mail-view";
import { ComposeModal } from "./compose-modal";
import { StorageUpgradeModal } from "./storage-upgrade-modal";
import type { PublicMailUser, MailMessage } from "@/lib/public-mail/webmail-service";

interface ExtendedUser extends PublicMailUser {
  usage_percent: number;
}

export function MailClient({ initialUser }: { initialUser: ExtendedUser }) {
  const router = useRouter();
  const [user, setUser] = useState<ExtendedUser>(initialUser);
  const [folder, setFolder] = useState<string>("inbox");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [prefilledReply, setPrefilledReply] = useState<MailMessage | null>(null);

  // Fetch messages
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const q = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : "";
      const res = await fetch(`/api/mail/messages?folder=${folder}${q}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        // Auto-select first message on desktop if none selected
        if (data.messages && data.messages.length > 0 && !selectedMessageId) {
          setSelectedMessageId(data.messages[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [folder, searchQuery, selectedMessageId]);

  // Refresh user info / storage usage
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/mail/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-refresh periodically (every 12 seconds) to immediately catch incoming OTP codes
  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages();
      refreshUser();
    }, 12000);
    return () => clearInterval(interval);
  }, [loadMessages, refreshUser]);

  const handleSelectMessage = (id: string) => {
    setSelectedMessageId(id);
    // Mark as read in local state
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_read: true } : m))
    );
    // Trigger read update
    fetch(`/api/mail/messages/${id}`, { method: "PATCH", body: JSON.stringify({ is_read: true }) });
  };

  const handleToggleStar = async (id: string, isStarred: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_starred: isStarred } : m))
    );
    await fetch(`/api/mail/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_starred: isStarred }),
    });
  };

  const handleDeleteMessage = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedMessageId === id) {
      const remaining = messages.filter((m) => m.id !== id);
      setSelectedMessageId(remaining.length > 0 ? remaining[0].id : null);
    }
    await fetch(`/api/mail/messages/${id}`, { method: "DELETE" });
    refreshUser();
  };

  const handleReply = (message: MailMessage) => {
    setPrefilledReply(message);
    setComposeOpen(true);
  };

  const handleLogout = async () => {
    await fetch("/api/mail/login", { method: "DELETE" });
    router.push("/mail/login");
    router.refresh();
  };

  const selectedMessage = messages.find((m) => m.id === selectedMessageId) || null;
  const unreadCount = messages.filter((m) => !m.is_read).length;
  const availableBytes = Math.max(0, user.quota_bytes - user.used_bytes);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans">
      {/* Top Navbar */}
      <MailNavbar
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLogout={handleLogout}
        onOpenUpgrade={() => setUpgradeOpen(true)}
      />

      {/* Warning Banner if quota is high */}
      {user.usage_percent >= 80 && (
        <div
          className={`px-6 py-2 flex items-center justify-between text-xs font-medium ${
            user.usage_percent >= 95
              ? "bg-rose-600 text-white"
              : "bg-amber-500 text-slate-950"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {user.usage_percent >= 95
                ? `Critical: Your mailbox is ${user.usage_percent}% full. Incoming emails may bounce.`
                : `Notice: You have used ${user.usage_percent}% of your storage quota.`}
            </span>
          </div>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="px-3 py-1 rounded bg-white text-slate-900 font-bold hover:bg-slate-100 transition-colors shadow-sm"
          >
            Upgrade Storage Plan
          </button>
        </div>
      )}

      {/* Main Mail Viewport */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <MailSidebar
          activeFolder={folder}
          onSelectFolder={(f) => {
            setFolder(f);
            setSelectedMessageId(null);
          }}
          onOpenCompose={() => {
            setPrefilledReply(null);
            setComposeOpen(true);
          }}
          onOpenUpgrade={() => setUpgradeOpen(true)}
          storageUsedBytes={user.used_bytes}
          storageQuotaBytes={user.quota_bytes}
          storageWarningLevel={user.storage_warning_level}
          unreadCount={unreadCount}
        />

        {/* Message List Column */}
        <div className="w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full bg-white dark:bg-slate-900 shrink-0">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 capitalize">
              {folder} &bull; {messages.length}
            </span>
            <button
              onClick={() => loadMessages()}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title="Refresh messages"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <MailList
              messages={messages}
              selectedMessageId={selectedMessageId}
              onSelectMessage={handleSelectMessage}
              onToggleStar={handleToggleStar}
              folderName={folder}
            />
          </div>
        </div>

        {/* Message Reading Pane */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
          {selectedMessage ? (
            <MailView
              message={selectedMessage}
              onBack={() => setSelectedMessageId(null)}
              onDelete={handleDeleteMessage}
              onToggleStar={handleToggleStar}
              onReply={handleReply}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <HardDrive className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Select an email to view
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Choose an email from the list on the left to read its contents or copy verification codes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => {
          loadMessages();
          refreshUser();
        }}
        senderEmail={user.email_address}
        availableStorageBytes={availableBytes}
      />

      {/* Storage Upgrade Dialog */}
      <StorageUpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlanId={user.plan_id}
        onUpgradeSuccess={(newPlan, newQuota) => {
          setUser((prev) => ({
            ...prev,
            plan_id: newPlan,
            quota_bytes: newQuota,
            usage_percent: Math.min(100, Math.round((prev.used_bytes / newQuota) * 100)),
          }));
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type {
  DgtConversation, DgtDirectory, DgtMessage,
} from "@/lib/dgt-connect/types";
import type { SupportedLanguage } from "@/lib/i18n/languages";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error?.message || `Request failed (${res.status})`);
  }
  return (json.data ?? json) as T;
}

export type DgtConnectState = ReturnType<typeof useDgtConnect>;

export function useDgtConnect(lang: SupportedLanguage, enabled: boolean) {
  const [conversations, setConversations] = useState<DgtConversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [typingByConv, setTypingByConv] = useState<Record<string, string[]>>({});
  const [directory, setDirectory] = useState<DgtDirectory | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DgtMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translateView, setTranslateView] = useState(true);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const refreshConversations = useCallback(async () => {
    try {
      const d = await api<{ conversations: DgtConversation[] }>("/api/erp/dgt-connect/conversations");
      setConversations(d.conversations);
    } catch (e) { setError((e as Error).message); }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const d = await api<{ total: number; byConversation: Record<string, number>; typing: Record<string, string[]> }>(
        "/api/erp/dgt-connect/unread"
      );
      setUnreadTotal(d.total);
      setUnreadByConv(d.byConversation);
      setTypingByConv(d.typing);
    } catch { /* silent */ }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, opts: { before?: string } = {}) => {
    setLoadingMessages(true);
    try {
      const qs = new URLSearchParams({ lang, translate: translateView ? "1" : "0", limit: "40" });
      if (opts.before) qs.set("before", opts.before);
      const d = await api<{ messages: DgtMessage[] }>(`/api/erp/dgt-connect/conversations/${conversationId}/messages?${qs}`);
      setMessages((prev) => (opts.before ? [...d.messages, ...prev] : d.messages));
      if (!opts.before) {
        await api(`/api/erp/dgt-connect/conversations/${conversationId}/read`, { method: "POST" });
        void refreshUnread();
        void refreshConversations();
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingMessages(false); }
  }, [lang, translateView, refreshUnread, refreshConversations]);

  const openConversation = useCallback((conversationId: string) => {
    setActiveId(conversationId);
    setMessages([]);
    void loadMessages(conversationId);
  }, [loadMessages]);

  const openDirect = useCallback(async (userId: string) => {
    try {
      const d = await api<{ conversationId: string }>("/api/erp/dgt-connect/conversations", {
        method: "POST", body: JSON.stringify({ kind: "direct", userId }),
      });
      await refreshConversations();
      openConversation(d.conversationId);
      return d.conversationId;
    } catch (e) { setError((e as Error).message); return null; }
  }, [refreshConversations, openConversation]);

  const createGroup = useCallback(async (title: string, memberIds: string[]) => {
    try {
      const d = await api<{ conversationId: string }>("/api/erp/dgt-connect/conversations", {
        method: "POST", body: JSON.stringify({ kind: "group", title, memberIds }),
      });
      await refreshConversations();
      openConversation(d.conversationId);
      return d.conversationId;
    } catch (e) { setError((e as Error).message); return null; }
  }, [refreshConversations, openConversation]);

  const send = useCallback(async (body: string, extra?: Partial<Pick<DgtMessage, "attachment" | "sharedRecord" | "replyToId">>) => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    try {
      const d = await api<{ message: DgtMessage }>(`/api/erp/dgt-connect/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, bodyLang: lang, attachment: extra?.attachment ?? null, sharedRecord: extra?.sharedRecord ?? null, replyToId: extra?.replyToId ?? null }),
      });
      setMessages((prev) => [...prev.filter((m) => m.id !== d.message.id), d.message]);
      void refreshConversations();
    } catch (e) { setError((e as Error).message); }
  }, [lang, refreshConversations]);

  const notifyTyping = useCallback(async () => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    try { await api("/api/erp/dgt-connect/typing", { method: "POST", body: JSON.stringify({ conversationId }) }); } catch { /* */ }
  }, []);

  const loadDirectory = useCallback(async () => {
    try { setDirectory(await api<DgtDirectory>("/api/erp/dgt-connect/directory")); }
    catch (e) { setError((e as Error).message); }
  }, []);

  // presence heartbeat + unread poll
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const beat = () => { if (alive) void api("/api/erp/dgt-connect/presence", { method: "POST", body: JSON.stringify({ status: "online" }) }).catch(() => {}); };
    beat();
    void refreshConversations();
    void refreshUnread();
    const hb = setInterval(beat, 30_000);
    const up = setInterval(() => { void refreshUnread(); }, 15_000);
    return () => { alive = false; clearInterval(hb); clearInterval(up); };
  }, [enabled, refreshConversations, refreshUnread]);

  // realtime: any change → refetch the relevant slice
  useEffect(() => {
    if (!enabled) return;
    let supabase: ReturnType<typeof createClientSupabaseClient>;
    try { supabase = createClientSupabaseClient(); } catch { return; }
    const channel = supabase
      .channel("dgt-connect")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "dgt_messages" }, (payload: any) => {
        const convId = payload?.new?.conversation_id;
        void refreshUnread();
        void refreshConversations();
        if (convId && convId === activeIdRef.current) void loadMessages(convId);
      })
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "dgt_message_receipts" }, () => {
        const convId = activeIdRef.current;
        if (convId) void loadMessages(convId);
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dgt_presence" }, () => {
        void refreshUnread();
        void refreshConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, refreshUnread, refreshConversations, loadMessages]);

  return {
    conversations, unreadTotal, unreadByConv, typingByConv, directory,
    activeId, messages, loadingMessages, error, translateView,
    setTranslateView, setActiveId,
    refreshConversations, refreshUnread, loadDirectory,
    openConversation, openDirect, createGroup, send, notifyTyping, loadMessages,
    clearError: () => setError(null),
  };
}

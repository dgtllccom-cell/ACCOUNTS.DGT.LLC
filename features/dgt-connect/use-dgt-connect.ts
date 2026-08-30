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

export function useDgtConnect(lang: SupportedLanguage, enabled: boolean, currentUserId: string) {
  const [conversations, setConversations] = useState<DgtConversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [typingByConv, setTypingByConv] = useState<Record<string, string[]>>({});
  const [directory, setDirectory] = useState<DgtDirectory | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DgtMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [translateView, setTranslateView] = useState(true);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const refreshConversations = useCallback(async () => {
    try {
      const d = await api<{ conversations: DgtConversation[]; setupPending?: boolean }>("/api/erp/dgt-connect/conversations");
      setConversations(d.conversations || []);
      setSetupPending(Boolean(d.setupPending));
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

  // Lightweight poll of the open thread — merges by id, does not reset scroll or
  // re-mark-read. Used as the live fallback when realtime is unavailable.
  const pollActiveMessages = useCallback(async (conversationId: string) => {
    try {
      const qs = new URLSearchParams({ lang, translate: translateView ? "1" : "0", limit: "40" });
      const d = await api<{ messages: DgtMessage[] }>(`/api/erp/dgt-connect/conversations/${conversationId}/messages?${qs}`);
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        let changed = prev.length !== d.messages.length;
        for (const m of d.messages) {
          const old = byId.get(m.id);
          if (!old || old.readCount !== m.readCount || old.deliveredCount !== m.deliveredCount || old.deletedAt !== m.deletedAt) changed = true;
          byId.set(m.id, m);
        }
        if (!changed) return prev;
        return d.messages.map((m) => byId.get(m.id)!);
      });
      const hasIncoming = d.messages.some((m) => m.senderId !== currentUserId);
      if (hasIncoming) {
        await api(`/api/erp/dgt-connect/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
        void refreshUnread();
      }
    } catch { /* silent */ }
  }, [lang, translateView, refreshUnread, currentUserId]);
  const pollRef = useRef(pollActiveMessages);
  pollRef.current = pollActiveMessages;

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

  const send = useCallback(async (body: string, extra?: Partial<Pick<DgtMessage, "attachment" | "sharedRecord" | "replyToId">> & { conversationId?: string }) => {
    const conversationId = extra?.conversationId ?? activeIdRef.current;
    if (!conversationId) return;
    // Tag the message with the language it is actually written in, not just the
    // UI language — a user typing English while the ERP is in Urdu must still be
    // tagged 'en' so the translated view for others is correct.
    const arabicScript = (body.match(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g) || []).length;
    const latin = (body.match(/[A-Za-z]/g) || []).length;
    const rtl = ["ur", "ar", "fa", "ps"];
    let bodyLang = lang;
    if (arabicScript > latin && !rtl.includes(lang)) bodyLang = "ur";
    else if (latin > arabicScript * 2 && rtl.includes(lang)) bodyLang = "en";
    try {
      const d = await api<{ message: DgtMessage }>(`/api/erp/dgt-connect/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, bodyLang, attachment: extra?.attachment ?? null, sharedRecord: extra?.sharedRecord ?? null, replyToId: extra?.replyToId ?? null }),
      });
      setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
      void refreshConversations();
      void refreshUnread();
    } catch (e) { setError((e as Error).message); }
  }, [lang, refreshConversations, refreshUnread]);

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
    // Fallback poll for the OPEN thread — keeps the chat live even when the
    // Supabase realtime websocket is unavailable.
    const tp = setInterval(() => {
      const id = activeIdRef.current;
      if (id) void pollRef.current?.(id);
    }, 6_000);
    return () => { alive = false; clearInterval(hb); clearInterval(up); clearInterval(tp); };
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
    activeId, messages, loadingMessages, error, setupPending, translateView,
    setTranslateView, setActiveId,
    refreshConversations, refreshUnread, loadDirectory,
    openConversation, openDirect, createGroup, send, notifyTyping, loadMessages,
    clearError: () => setError(null),
  };
}

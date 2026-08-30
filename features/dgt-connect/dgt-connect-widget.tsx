"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, X, Search, Plus, Users, ChevronLeft, Send, Paperclip,
  Check, CheckCheck, Languages, Circle,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { useDgtConnect } from "./use-dgt-connect";
import { DGT_SHARE_EVENT } from "./share-bridge";
import type { DgtConversation, DgtDirectoryUser, DgtMessage, DgtSharedRecord } from "@/lib/dgt-connect/types";

const RTL = new Set(["ur", "ar", "fa", "ps"]);

function presenceDot(p: string | null | undefined) {
  return p === "online" ? "text-emerald-500" : p === "away" ? "text-amber-500" : "text-slate-300 dark:text-slate-600";
}
function timeShort(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DgtConnectWidget({ currentUserId }: { currentUserId: string }) {
  const lang = useActiveLanguage();
  const isRtl = RTL.has(lang);
  const tt = (k: string, f: string) => t(lang, k as never, f);
  const [open, setOpen] = useState(false);
  const c = useDgtConnect(lang, true, currentUserId);

  const [view, setView] = useState<"list" | "thread" | "new">("list");
  const [pendingShare, setPendingShare] = useState<DgtSharedRecord | null>(null);
  const [search, setSearch] = useState("");

  // any ERP screen can push a record in via shareToDgtConnect()
  useEffect(() => {
    const handler = (e: Event) => {
      const rec = (e as CustomEvent).detail as DgtSharedRecord;
      if (!rec?.id) return;
      setPendingShare(rec);
      setOpen(true);
      setView("list");
    };
    window.addEventListener(DGT_SHARE_EVENT, handler);
    return () => window.removeEventListener(DGT_SHARE_EVENT, handler);
  }, []);
  const [searchResults, setSearchResults] = useState<Array<{ conversationId: string; body: string; senderName: string; createdAt: string; displayName: string }>>([]);

  useEffect(() => {
    if (!open) return;
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const h = setTimeout(async () => {
      try {
        const res = await fetch(`/api/erp/dgt-connect/search?q=${encodeURIComponent(search.trim())}`);
        const j = await res.json();
        setSearchResults(j?.data?.results ?? []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(h);
  }, [search, open]);

  const active = useMemo(() => c.conversations.find((x) => x.id === c.activeId) ?? null, [c.conversations, c.activeId]);

  return (
    <div data-dgt-connect dir={isRtl ? "rtl" : "ltr"} className={cn("no-print fixed z-[9998] bottom-4", isRtl ? "left-4" : "right-4")}>
      {open && (
        <div className="mb-3 flex h-[70vh] max-h-[620px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          {/* header */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            {view !== "list" ? (
              <button onClick={() => { setView("list"); c.setActiveId(null); }} className="rounded-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label={tt("dgtc.close", "Close")}>
                <ChevronLeft className={cn("h-4 w-4", isRtl && "rotate-180")} />
              </button>
            ) : (
              <MessageCircle className="h-5 w-5 text-blue-600" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-900 dark:text-slate-100">
                {view === "thread" ? (active?.displayName || tt("dgtc.title", "DGT Connect"))
                  : view === "new" ? tt("dgtc.new_chat", "New chat")
                  : tt("dgtc.title", "DGT Connect")}
              </div>
              {view === "thread" && active?.kind === "direct" && (
                <div className={cn("text-[10px] font-bold", presenceDot(active.peerPresence))}>
                  {active.peerPresence === "online" ? tt("dgtc.online", "Online") : tt("dgtc.offline", "Offline")}
                </div>
              )}
              {view === "list" && <div className="text-[10px] font-medium text-slate-400">{tt("dgtc.subtitle", "Internal ERP chat")}</div>}
            </div>
            {view === "list" && (
              <button onClick={() => { setView("new"); void c.loadDirectory(); }} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40" aria-label={tt("dgtc.new_chat", "New chat")}>
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label={tt("dgtc.close", "Close")}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {c.error && (
            <div className="flex items-center justify-between gap-2 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <span className="truncate">{c.error}</span>
              <button onClick={c.clearError} className="shrink-0"><X className="h-3 w-3" /></button>
            </div>
          )}
          {c.setupPending && !c.error && (
            <div className="bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {tt("dgtc.setup_pending", "DGT Connect is being set up on this server. Check back shortly.")}
            </div>
          )}

          {view === "list" && (
            <>
              {pendingShare && (
                <div className="flex items-center justify-between gap-2 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  <span className="truncate">{tt("dgtc.share_record", "Share ERP record")}: {pendingShare.label} → …</span>
                  <button onClick={() => setPendingShare(null)}><X className="h-3 w-3" /></button>
                </div>
              )}
              <ConversationListView
                conversations={c.conversations} unreadByConv={c.unreadByConv} typingByConv={c.typingByConv}
                search={search} setSearch={setSearch} searchResults={searchResults}
                onOpen={async (id) => {
                  if (pendingShare) {
                    await c.send("", { sharedRecord: pendingShare, conversationId: id });
                    setPendingShare(null);
                  }
                  c.openConversation(id);
                  setView("thread"); setSearch("");
                }}
                tt={tt} isRtl={isRtl}
              />
            </>
          )}

          {view === "new" && (
            <NewConversationView
              directory={c.directory}
              onStartDirect={async (u) => { const id = await c.openDirect(u); if (id) setView("thread"); }}
              onCreateGroup={async (title, ids) => { const id = await c.createGroup(title, ids); if (id) setView("thread"); }}
              tt={tt}
            />
          )}

          {view === "thread" && c.activeId && (
            <MessageThreadView
              conversationId={c.activeId}
              currentUserId={currentUserId}
              conversation={active}
              messages={c.messages}
              loading={c.loadingMessages}
              typing={c.typingByConv[c.activeId] ?? []}
              translateView={c.translateView}
              setTranslateView={c.setTranslateView}
              onLoadMore={(before) => c.loadMessages(c.activeId!, { before })}
              onSend={c.send}
              onTyping={c.notifyTyping}
              tt={tt} lang={lang} isRtl={isRtl}
            />
          )}
        </div>
      )}

      {/* floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-500 active:scale-95"
        aria-label={tt("dgtc.open", "Open chat")}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && c.unreadTotal > 0 && (
          <span className="absolute -top-1 -end-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {c.unreadTotal > 99 ? "99+" : c.unreadTotal}
          </span>
        )}
      </button>
    </div>
  );
}

function ConversationListView({
  conversations, unreadByConv, typingByConv, search, setSearch, searchResults, onOpen, tt, isRtl,
}: {
  conversations: DgtConversation[];
  unreadByConv: Record<string, number>;
  typingByConv: Record<string, string[]>;
  search: string; setSearch: (v: string) => void;
  searchResults: Array<{ conversationId: string; body: string; senderName: string; createdAt: string; displayName: string }>;
  onOpen: (id: string) => void;
  tt: (k: string, f: string) => string; isRtl: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-100 p-2 dark:border-slate-800">
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-2.5 py-1.5 dark:bg-slate-900">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tt("dgtc.search_placeholder", "Search people and messages")}
            className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {search.trim().length >= 2 ? (
          searchResults.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">{tt("dgtc.no_results", "No results")}</p>
          ) : searchResults.map((r) => (
            <button key={r.conversationId + r.createdAt} onClick={() => onOpen(r.conversationId)} className="flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-3 py-2 text-start hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{r.displayName}</span>
              <span className="line-clamp-1 text-[11px] text-slate-500">{r.senderName}: {r.body}</span>
            </button>
          ))
        ) : conversations.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400">{tt("dgtc.no_conversations", "No conversations yet")}</p>
        ) : conversations.map((conv) => {
          const unread = unreadByConv[conv.id] ?? 0;
          const typing = typingByConv[conv.id] ?? [];
          return (
            <button key={conv.id} onClick={() => onOpen(conv.id)} className="flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2.5 text-start hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {conv.kind === "group" ? <Users className="h-4 w-4" /> : (conv.displayName[0] || "?").toUpperCase()}
                </div>
                {conv.kind === "direct" && (
                  <Circle className={cn("absolute -bottom-0.5 h-2.5 w-2.5 fill-current", isRtl ? "-start-0.5" : "-end-0.5", presenceDot(conv.peerPresence))} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{conv.displayName}</span>
                  <span className="shrink-0 text-[9px] font-medium text-slate-400">{timeShort(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-[11px] text-slate-500">
                    {typing.length ? <em className="text-emerald-600">{tt("dgtc.typing", "typing…")}</em> : (conv.lastMessagePreview || "")}
                  </span>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white">{unread}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewConversationView({
  directory, onStartDirect, onCreateGroup, tt,
}: {
  directory: import("@/lib/dgt-connect/types").DgtDirectory | null;
  onStartDirect: (userId: string) => void;
  onCreateGroup: (title: string, ids: string[]) => void;
  tt: (k: string, f: string) => string;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  type Row =
    | { type: "country"; label: string }
    | { type: "branch"; label: string }
    | { type: "user"; u: DgtDirectoryUser };
  const rows: Row[] = [];
  if (directory?.globalUsers?.length) {
    rows.push({ type: "country", label: "—" });
    for (const u of directory.globalUsers) rows.push({ type: "user", u });
  }
  for (const country of directory?.countries ?? []) {
    rows.push({ type: "country", label: country.name });
    for (const u of country.countryUsers) rows.push({ type: "user", u });
    for (const b of country.branches) {
      rows.push({ type: "branch", label: b.name });
      for (const u of b.users) rows.push({ type: "user", u });
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-slate-100 p-2 dark:border-slate-800">
        <button onClick={() => setMode("direct")} className={cn("flex-1 rounded-lg px-2 py-1 text-[11px] font-bold", mode === "direct" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-900")}>
          {tt("dgtc.direct_message", "Direct message")}
        </button>
        <button onClick={() => setMode("group")} className={cn("flex-1 rounded-lg px-2 py-1 text-[11px] font-bold", mode === "group" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-900")}>
          {tt("dgtc.new_group", "New group")}
        </button>
      </div>
      {mode === "group" && (
        <input
          value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)}
          placeholder={tt("dgtc.group_name", "Group name")}
          className="m-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none dark:border-slate-800 dark:bg-slate-900"
        />
      )}
      <p className="px-3 pb-1 pt-2 text-[10px] font-medium text-slate-400">{tt("dgtc.scope_note", "You can message users within your assigned scope.")}</p>
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && <p className="p-4 text-center text-xs text-slate-400">{tt("dgtc.no_results", "No results")}</p>}
        {rows.map((row, i) => {
          if (row.type === "country") return <div key={i} className="bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900">{row.label}</div>;
          if (row.type === "branch") return <div key={i} className="px-4 py-1 text-[10px] font-bold text-slate-400">{row.label}</div>;
          const u = row.u;
          return (
            <button
              key={i}
              onClick={() => (mode === "direct" ? onStartDirect(u.id) : toggle(u.id))}
              className={cn("flex w-full items-center gap-2.5 px-4 py-2 text-start hover:bg-slate-50 dark:hover:bg-slate-900", mode === "group" && selected.includes(u.id) && "bg-blue-50 dark:bg-blue-950/30")}
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800">
                {(u.name[0] || "?").toUpperCase()}
                <Circle className={cn("absolute -bottom-0.5 -end-0.5 h-2 w-2 fill-current", presenceDot(u.presence))} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{u.name}</div>
                <div className="truncate text-[10px] text-slate-400">{u.role ?? ""}</div>
              </div>
              {mode === "group" && selected.includes(u.id) && <Check className="h-4 w-4 text-blue-600" />}
            </button>
          );
        })}
      </div>
      {mode === "group" && (
        <button
          disabled={!groupTitle.trim() || selected.length === 0}
          onClick={() => onCreateGroup(groupTitle.trim(), selected)}
          className="m-2 rounded-xl bg-blue-600 py-2 text-xs font-black text-white disabled:opacity-40"
        >
          {tt("dgtc.create", "Create")} ({selected.length})
        </button>
      )}
    </div>
  );
}

function MessageThreadView({
  conversationId, currentUserId, conversation, messages, loading, typing, translateView, setTranslateView, onLoadMore, onSend, onTyping, tt, lang, isRtl,
}: {
  conversationId: string;
  currentUserId: string;
  conversation: DgtConversation | null;
  messages: DgtMessage[];
  loading: boolean;
  typing: string[];
  translateView: boolean;
  setTranslateView: (v: boolean) => void;
  onLoadMore: (before: string) => void;
  onSend: (body: string, extra?: any) => void;
  onTyping: () => void;
  tt: (k: string, f: string) => string; lang: string; isRtl: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing.length]);


  async function handleFile(file: File) {
    if (file.size > 15 * 1024 * 1024) { alert(tt("dgtc.attachment_too_large", "File too large (max 15 MB)")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      onSend("", { attachment: { name: file.name, mime: file.type || "application/octet-stream", size: file.size, dataUrl: String(reader.result) } });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-end gap-1 border-b border-slate-100 px-2 py-1 dark:border-slate-800">
        <button
          onClick={() => setTranslateView(!translateView)}
          className={cn("flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold", translateView ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-900")}
        >
          <Languages className="h-3 w-3" /> {tt("dgtc.translate", "Translate")}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length >= 40 && (
          <button onClick={() => onLoadMore(messages[0].createdAt)} className="mx-auto block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-900">
            {tt("dgtc.load_more", "Load earlier messages")}
          </button>
        )}
        {loading && messages.length === 0 && <p className="text-center text-[11px] text-slate-400">…</p>}
        {!loading && messages.length === 0 && <p className="text-center text-xs text-slate-400">{tt("dgtc.no_messages", "No messages yet")}</p>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const showOrig = showOriginal[m.id];
          const displayBody = m.deletedAt ? tt("dgtc.deleted_message", "This message was deleted")
            : (translateView && m.translated && !showOrig) ? m.translated.text
            : m.body;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-2xl px-3 py-1.5", mine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100")}>
                {conversation?.kind === "group" && !mine && (
                  <div className="mb-0.5 text-[10px] font-black text-blue-600 dark:text-blue-300">{m.senderName}</div>
                )}
                {m.kind === "attachment" && m.attachment && (
                  <a href={m.attachment.dataUrl || m.attachment.url || "#"} download={m.attachment.name} className="mb-1 flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1 text-[11px] font-bold underline">
                    <Paperclip className="h-3 w-3" /> {m.attachment.name}
                  </a>
                )}
                {m.kind === "record_share" && m.sharedRecord && (
                  <a href={m.sharedRecord.route || "#"} className="mb-1 block rounded-lg bg-black/10 px-2 py-1 text-[11px]">
                    <div className="font-black">{m.sharedRecord.label}</div>
                    {m.sharedRecord.summary && <div className="opacity-80">{m.sharedRecord.summary}</div>}
                  </a>
                )}
                {displayBody && <div className="whitespace-pre-wrap break-words text-xs">{displayBody}</div>}
                {translateView && m.translated && !m.deletedAt && (
                  <button onClick={() => setShowOriginal((s) => ({ ...s, [m.id]: !s[m.id] }))} className={cn("mt-0.5 text-[9px] font-bold underline", mine ? "text-blue-100" : "text-slate-400")}>
                    {showOrig ? tt("dgtc.translated", "Translated") : `${tt("dgtc.show_original", "Show original")} (${m.bodyLang.toUpperCase()})`}
                  </button>
                )}
                <div className={cn("mt-0.5 flex items-center gap-1 text-[8.5px]", mine ? "text-blue-100" : "text-slate-400")}>
                  <span>{timeShort(m.createdAt)}</span>
                  {mine && (m.readCount > 0 ? <CheckCheck className="h-3 w-3 text-sky-300" /> : m.deliveredCount > 0 ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        {typing.length > 0 && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3 py-1.5 text-[11px] italic text-slate-500 dark:bg-slate-800">
              {typing.join(", ")} {tt("dgtc.typing", "typing…")}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end gap-1.5 border-t border-slate-200 p-2 dark:border-slate-800">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={tt("dgtc.attach", "Attach file")}>
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value); onTyping(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) { onSend(draft.trim()); setDraft(""); } } }}
          rows={1}
          placeholder={tt("dgtc.message_placeholder", "Type a message")}
          className="max-h-24 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
        />
        <button
          onClick={() => { if (draft.trim()) { onSend(draft.trim()); setDraft(""); } }}
          disabled={!draft.trim()}
          className="rounded-xl bg-blue-600 p-2 text-white disabled:opacity-40"
          aria-label={tt("dgtc.send", "Send")}
        >
          <Send className={cn("h-4 w-4", isRtl && "-scale-x-100")} />
        </button>
      </div>
    </div>
  );
}

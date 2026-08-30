import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { dgtCanReach, dgtReachableUserIds, directKeyFor } from "./access";
import { getMessageTranslation } from "./translate";
import type {
  DgtAttachment, DgtConversation, DgtMessage, DgtMessageKind, DgtParticipant, DgtSharedRecord,
} from "./types";

function asLang(v: unknown): SupportedLanguage {
  return (["en", "ur", "ps", "fa", "ar"].includes(String(v)) ? v : "en") as SupportedLanguage;
}

export class DgtAccessError extends Error {
  status = 403;
  constructor(message = "Not permitted") { super(message); }
}

const STALE_MS = 65_000;
function presenceFrom(status: string | null, last: string | null): "online" | "away" | "offline" {
  if (!status || !last) return "offline";
  return Date.now() - new Date(last).getTime() < STALE_MS ? (status as any) : "offline";
}

/** Membership guard — every conversation read/write funnels through this. */
export async function requireMembership(session: ErpSession, conversationId: string): Promise<void> {
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select 1 from public.dgt_conversation_participants
      where conversation_id = ${conversationId}::uuid
        and user_id = ${session.userId}::uuid
        and left_at is null
      limit 1
    `) as unknown as unknown[];
  });
  if (!rows || rows.length === 0) throw new DgtAccessError("You are not a participant of this conversation");
}

/** Open (or create) a direct conversation between the caller and `targetUserId`. */
export async function openDirectConversation(session: ErpSession, targetUserId: string): Promise<string> {
  if (!(await dgtCanReach(session, targetUserId))) {
    throw new DgtAccessError("You are not allowed to message this user");
  }
  const key = directKeyFor(session.userId, targetUserId);
  const id = await withLocalPg(async (sql) => {
    const existing = (await sql`select id from public.dgt_conversations where direct_key = ${key} limit 1`) as unknown as { id: string }[];
    if (existing[0]) return existing[0].id;

    const created = (await sql`
      insert into public.dgt_conversations (kind, created_by, direct_key)
      values ('direct', ${session.userId}::uuid, ${key})
      returning id
    `) as unknown as { id: string }[];
    const convId = created[0].id;
    await sql`
      insert into public.dgt_conversation_participants (conversation_id, user_id, role)
      values (${convId}::uuid, ${session.userId}::uuid, 'admin'),
             (${convId}::uuid, ${targetUserId}::uuid, 'member')
      on conflict do nothing
    `;
    return convId;
  });
  if (!id) throw new Error("Database unavailable");
  return id;
}

/** Create a group conversation. Every member must be reachable by the caller. */
export async function createGroupConversation(
  session: ErpSession,
  title: string,
  memberIds: string[],
): Promise<string> {
  const reachable = await dgtReachableUserIds(session);
  const members = [...new Set(memberIds.filter((m) => m && m !== session.userId))];
  for (const m of members) {
    if (!reachable.has(m)) throw new DgtAccessError("One or more selected users are outside your scope");
  }
  if (members.length === 0) throw new DgtAccessError("Select at least one participant");

  const id = await withLocalPg(async (sql) => {
    const created = (await sql`
      insert into public.dgt_conversations (kind, title, created_by)
      values ('group', ${title.trim().slice(0, 120)}, ${session.userId}::uuid)
      returning id
    `) as unknown as { id: string }[];
    const convId = created[0].id;
    await sql`
      insert into public.dgt_conversation_participants (conversation_id, user_id, role)
      values (${convId}::uuid, ${session.userId}::uuid, 'admin')
    `;
    for (const m of members) {
      await sql`
        insert into public.dgt_conversation_participants (conversation_id, user_id, role)
        values (${convId}::uuid, ${m}::uuid, 'member')
        on conflict do nothing
      `;
    }
    return convId;
  });
  if (!id) throw new Error("Database unavailable");
  return id;
}

export async function listConversations(session: ErpSession): Promise<DgtConversation[]> {
  const rows = await withLocalPg(async (sql) => {
    const convs = (await sql`
      select c.id, c.kind, c.title, c.last_message_at, c.last_message_preview,
             cp.last_read_at
      from public.dgt_conversations c
      join public.dgt_conversation_participants cp
        on cp.conversation_id = c.id and cp.user_id = ${session.userId}::uuid and cp.left_at is null
      order by coalesce(c.last_message_at, c.created_at) desc
      limit 200
    `) as unknown as any[];
    if (convs.length === 0) return [];

    const ids = convs.map((c) => c.id);
    const parts = (await sql`
      select cp.conversation_id, cp.user_id, cp.role, cp.last_read_at,
             p.full_name, p.preferred_language_code,
             pr.status as presence_status, pr.last_seen_at
      from public.dgt_conversation_participants cp
      join public.profiles p on p.id = cp.user_id
      left join public.dgt_presence pr on pr.user_id = cp.user_id
      where cp.conversation_id = any(${ids}::uuid[]) and cp.left_at is null
    `) as unknown as any[];

    const unreadRows = (await sql`
      select m.conversation_id, count(*)::int as n
      from public.dgt_messages m
      join public.dgt_conversation_participants cp
        on cp.conversation_id = m.conversation_id and cp.user_id = ${session.userId}::uuid
      where m.conversation_id = any(${ids}::uuid[])
        and m.sender_id <> ${session.userId}::uuid
        and m.deleted_at is null
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
      group by m.conversation_id
    `) as unknown as { conversation_id: string; n: number }[];

    return convs.map((c) => {
      const cp = parts.filter((p) => p.conversation_id === c.id);
      const participants: DgtParticipant[] = cp.map((p) => ({
        userId: p.user_id,
        name: p.full_name || "User",
        role: p.role,
        lang: asLang(p.preferred_language_code),
        presence: presenceFrom(p.presence_status, p.last_seen_at),
        lastReadAt: p.last_read_at,
      }));
      const peer = c.kind === "direct" ? participants.find((p) => p.userId !== session.userId) ?? null : null;
      const unread = unreadRows.find((u) => u.conversation_id === c.id)?.n ?? 0;
      return {
        id: c.id,
        kind: c.kind,
        title: c.title,
        displayName: c.kind === "group" ? c.title || "Group" : peer?.name || "Direct message",
        participants,
        lastMessageAt: c.last_message_at,
        lastMessagePreview: c.last_message_preview,
        unread,
        peerPresence: peer?.presence ?? null,
        peerId: peer?.userId ?? null,
      } as DgtConversation;
    });
  });
  return rows ?? [];
}

export async function listMessages(
  session: ErpSession,
  conversationId: string,
  opts: { before?: string; limit?: number; viewerLang?: SupportedLanguage; translate?: boolean } = {},
): Promise<DgtMessage[]> {
  await requireMembership(session, conversationId);
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);

  const rows = await withLocalPg(async (sql) => {
    const msgs = (await sql`
      select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.body_lang,
             m.attachment, m.shared_record, m.reply_to_id, m.created_at, m.edited_at, m.deleted_at,
             p.full_name as sender_name,
             (select count(*)::int from public.dgt_message_receipts r where r.message_id = m.id and r.delivered_at is not null) as delivered_count,
             (select count(*)::int from public.dgt_message_receipts r where r.message_id = m.id and r.read_at is not null) as read_count
      from public.dgt_messages m
      join public.profiles p on p.id = m.sender_id
      where m.conversation_id = ${conversationId}::uuid
        ${opts.before ? sql`and m.created_at < ${opts.before}` : sql``}
      order by m.created_at desc
      limit ${limit}
    `) as unknown as any[];
    return msgs.reverse();
  });
  if (!rows) return [];

  const out: DgtMessage[] = [];
  for (const m of rows) {
    const bodyLang = asLang(m.body_lang);
    let translated: DgtMessage["translated"] = null;
    if (opts.translate && opts.viewerLang && bodyLang !== opts.viewerLang && m.kind === "text" && !m.deleted_at) {
      translated = await getMessageTranslation(m.id, opts.viewerLang);
    }
    out.push({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name || "User",
      kind: m.kind,
      body: m.deleted_at ? "" : m.body,
      bodyLang,
      attachment: (m.attachment as DgtAttachment) ?? null,
      sharedRecord: (m.shared_record as DgtSharedRecord) ?? null,
      replyToId: m.reply_to_id,
      createdAt: m.created_at,
      editedAt: m.edited_at,
      deletedAt: m.deleted_at,
      deliveredCount: m.delivered_count ?? 0,
      readCount: m.read_count ?? 0,
      translated,
    });
  }
  return out;
}

export async function sendMessage(
  session: ErpSession,
  conversationId: string,
  input: {
    kind?: DgtMessageKind;
    body: string;
    bodyLang?: SupportedLanguage;
    attachment?: DgtAttachment | null;
    sharedRecord?: DgtSharedRecord | null;
    replyToId?: string | null;
  },
): Promise<DgtMessage> {
  await requireMembership(session, conversationId);
  const kind = input.kind ?? (input.attachment ? "attachment" : input.sharedRecord ? "record_share" : "text");
  const body = (input.body ?? "").toString().slice(0, 8000);
  if (kind === "text" && !body.trim()) throw new DgtAccessError("Empty message");
  const bodyLang = input.bodyLang ?? (session.preferredLanguage as SupportedLanguage) ?? "en";

  const messageId = await withLocalPg(async (sql) => {
    const inserted = (await sql`
      insert into public.dgt_messages (conversation_id, sender_id, kind, body, body_lang, attachment, shared_record, reply_to_id)
      values (
        ${conversationId}::uuid, ${session.userId}::uuid, ${kind}, ${body}, ${bodyLang},
        ${input.attachment ? JSON.stringify(input.attachment) : null}::jsonb,
        ${input.sharedRecord ? JSON.stringify(input.sharedRecord) : null}::jsonb,
        ${input.replyToId ?? null}
      )
      returning id, created_at
    `) as unknown as { id: string; created_at: string }[];
    const mid = inserted[0].id;

    const preview =
      kind === "text" ? body.slice(0, 140)
      : kind === "attachment" ? `📎 ${input.attachment?.name ?? "attachment"}`
      : kind === "record_share" ? `🔗 ${input.sharedRecord?.label ?? "record"}`
      : body.slice(0, 140);
    await sql`
      update public.dgt_conversations
      set last_message_at = ${inserted[0].created_at}, last_message_preview = ${preview}
      where id = ${conversationId}::uuid
    `;

    // seed delivery receipts for the other participants
    await sql`
      insert into public.dgt_message_receipts (message_id, user_id, delivered_at)
      select ${mid}::uuid, cp.user_id, now()
      from public.dgt_conversation_participants cp
      where cp.conversation_id = ${conversationId}::uuid
        and cp.user_id <> ${session.userId}::uuid
        and cp.left_at is null
      on conflict do nothing
    `;
    // clear my typing flag
    await sql`update public.dgt_presence set typing_in_conversation = null where user_id = ${session.userId}::uuid`;
    return mid;
  });
  if (!messageId) throw new Error("Database unavailable");

  const [msg] = await listMessages(session, conversationId, { limit: 1 });
  return msg;
}

export async function markRead(session: ErpSession, conversationId: string): Promise<void> {
  await requireMembership(session, conversationId);
  await withLocalPg(async (sql) => {
    await sql`
      update public.dgt_conversation_participants
      set last_read_at = now()
      where conversation_id = ${conversationId}::uuid and user_id = ${session.userId}::uuid
    `;
    await sql`
      update public.dgt_message_receipts r
      set read_at = now()
      from public.dgt_messages m
      where r.message_id = m.id
        and m.conversation_id = ${conversationId}::uuid
        and r.user_id = ${session.userId}::uuid
        and r.read_at is null
    `;
  });
}

export async function setTyping(session: ErpSession, conversationId: string | null): Promise<void> {
  if (conversationId) await requireMembership(session, conversationId);
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.dgt_presence (user_id, status, last_seen_at, typing_in_conversation, typing_since)
      values (${session.userId}::uuid, 'online', now(), ${conversationId}, ${conversationId ? sql`now()` : null})
      on conflict (user_id) do update set
        status = 'online', last_seen_at = now(),
        typing_in_conversation = ${conversationId},
        typing_since = ${conversationId ? sql`now()` : null}
    `;
  });
}

export async function heartbeat(session: ErpSession, status: "online" | "away" = "online"): Promise<void> {
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.dgt_presence (user_id, status, last_seen_at)
      values (${session.userId}::uuid, ${status}, now())
      on conflict (user_id) do update set status = ${status}, last_seen_at = now()
    `;
  });
}

export async function unreadSummary(session: ErpSession): Promise<{ total: number; byConversation: Record<string, number>; typing: Record<string, string[]> }> {
  const res = await withLocalPg(async (sql) => {
    const rows = (await sql`
      select m.conversation_id, count(*)::int as n
      from public.dgt_messages m
      join public.dgt_conversation_participants cp
        on cp.conversation_id = m.conversation_id and cp.user_id = ${session.userId}::uuid and cp.left_at is null
      where m.sender_id <> ${session.userId}::uuid
        and m.deleted_at is null
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
      group by m.conversation_id
    `) as unknown as { conversation_id: string; n: number }[];

    const typingRows = (await sql`
      select pr.typing_in_conversation as conv, pr.user_id, p.full_name
      from public.dgt_presence pr
      join public.profiles p on p.id = pr.user_id
      join public.dgt_conversation_participants cp
        on cp.conversation_id = pr.typing_in_conversation and cp.user_id = ${session.userId}::uuid and cp.left_at is null
      where pr.typing_in_conversation is not null
        and pr.user_id <> ${session.userId}::uuid
        and pr.typing_since > now() - interval '8 seconds'
    `) as unknown as { conv: string; user_id: string; full_name: string | null }[];

    return { rows, typingRows };
  });

  const byConversation: Record<string, number> = {};
  const typing: Record<string, string[]> = {};
  let total = 0;
  for (const r of res?.rows ?? []) { byConversation[r.conversation_id] = r.n; total += r.n; }
  for (const t of res?.typingRows ?? []) {
    (typing[t.conv] ||= []).push(t.full_name || "Someone");
  }
  return { total, byConversation, typing };
}

export async function searchMessages(session: ErpSession, q: string): Promise<Array<{ conversationId: string; messageId: string; body: string; senderName: string; createdAt: string; displayName: string }>> {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select m.id as message_id, m.conversation_id, m.body, m.created_at,
             sp.full_name as sender_name, c.kind, c.title,
             (select pp.full_name from public.dgt_conversation_participants cpx
                join public.profiles pp on pp.id = cpx.user_id
                where cpx.conversation_id = c.id and cpx.user_id <> ${session.userId}::uuid limit 1) as peer_name
      from public.dgt_messages m
      join public.dgt_conversation_participants cp
        on cp.conversation_id = m.conversation_id and cp.user_id = ${session.userId}::uuid and cp.left_at is null
      join public.profiles sp on sp.id = m.sender_id
      join public.dgt_conversations c on c.id = m.conversation_id
      where m.deleted_at is null
        and m.kind = 'text'
        and m.body ilike ${"%" + term + "%"}
      order by m.created_at desc
      limit 40
    `) as unknown as any[];
  });
  return (rows ?? []).map((r) => ({
    conversationId: r.conversation_id,
    messageId: r.message_id,
    body: r.body,
    senderName: r.sender_name || "User",
    createdAt: r.created_at,
    displayName: r.kind === "group" ? (r.title || "Group") : (r.peer_name || "Direct message"),
  }));
}

import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateErp } from "@/lib/i18n/erp-translator";

/**
 * Translated VIEW of a chat message. The original text (`dgt_messages.body` +
 * `body_lang`) is never modified — this only produces / caches a rendering of it
 * in another language.
 *
 * Uses the central ERP translation service (`translateErp`): local approved
 * memory → ERP glossary → local machine memory → local phrase engine → external
 * MT fallback. The per-message result is additionally cached in
 * `dgt_message_translations` so a given message is rendered once per language.
 */
export async function getMessageTranslation(
  messageId: string,
  targetLang: SupportedLanguage
): Promise<{ lang: SupportedLanguage; text: string; engine: string } | null> {
  const rows = await withLocalPg(async (sql) => {
    const existing = (await sql`
      select t.text, t.engine
      from public.dgt_message_translations t
      where t.message_id = ${messageId}::uuid and t.lang = ${targetLang}
      limit 1
    `) as unknown as { text: string; engine: string }[];
    if (existing[0]) return { cached: existing[0], msg: null as any };

    const msg = (await sql`
      select body, body_lang, kind
      from public.dgt_messages
      where id = ${messageId}::uuid and deleted_at is null
      limit 1
    `) as unknown as { body: string; body_lang: string; kind: string }[];
    return { cached: null as any, msg: msg[0] ?? null };
  });

  if (!rows) return null;
  if (rows.cached) return { lang: targetLang, text: rows.cached.text, engine: rows.cached.engine };

  const msg = rows.msg;
  if (!msg || msg.kind !== "text" || !msg.body.trim()) return null;
  const sourceLang = (["en", "ur", "ps", "fa", "ar"].includes(msg.body_lang) ? msg.body_lang : "en") as SupportedLanguage;
  if (sourceLang === targetLang) return null;

  const result = await translateErp(msg.body, sourceLang, { targetLang, domain: "general" });
  if (!result.text || result.engine === "identity") return null;

  await withLocalPg(async (sql) => {
    await sql`
      insert into public.dgt_message_translations (message_id, lang, text, engine)
      values (${messageId}::uuid, ${targetLang}, ${result.text}, ${result.engine})
      on conflict (message_id, lang) do update set text = excluded.text, engine = excluded.engine
    `;
  });

  return { lang: targetLang, text: result.text, engine: result.engine };
}

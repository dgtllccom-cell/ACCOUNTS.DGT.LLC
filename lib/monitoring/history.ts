/**
 * Server & Project Monitoring — event history reader.
 * Reuses the existing centralized multilingual event log (erp_multilingual_events).
 * No new table: monitoring events are stored via recordEnterpriseMultilingualEvent
 * with source_module = 'server_monitoring', already translated into all 5 languages.
 */
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const MONITOR_SOURCE_MODULE = "server_monitoring";

export type MonitorHistoryItem = {
  id: string;
  eventType: string;
  severity: string;
  message: string;
  messageTranslations: Record<string, string> | null;
  branch: string | null;
  commitId: string | null;
  userName: string | null;
  createdAt: string;
};

function pickLang(translations: Record<string, string> | null, original: string, lang: SupportedLanguage): string {
  if (!translations) return original;
  return translations[lang] || translations.en || original;
}

export async function listMonitorHistory(lang: SupportedLanguage, limit = 50): Promise<MonitorHistoryItem[]> {
  const capped = Math.min(Math.max(1, limit), 200);
  try {
    const rows: any = await db.execute(sql`
      SELECT id, event_type, severity, message_original, message_translations, payload, created_at
      FROM erp_multilingual_events
      WHERE source_module = ${MONITOR_SOURCE_MODULE}
      ORDER BY created_at DESC
      LIMIT ${capped}
    `);
    const arr = Array.isArray(rows) ? rows : rows?.rows || [];
    return arr.map((r: any) => {
      const translations = (r.message_translations && typeof r.message_translations === "object" ? r.message_translations : null) as Record<string, string> | null;
      const payload = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, any>;
      return {
        id: String(r.id),
        eventType: String(r.event_type || ""),
        severity: String(r.severity || "info"),
        message: pickLang(translations, String(r.message_original || ""), lang),
        messageTranslations: translations,
        branch: payload.branch ?? null,
        commitId: payload.commitId ?? payload.commit ?? null,
        userName: payload.actorName ?? null,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
      };
    });
  } catch {
    // Table may not exist in a given environment — degrade gracefully.
    return [];
  }
}

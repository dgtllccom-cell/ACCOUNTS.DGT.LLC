/**
 * Contract Intelligence — local deterministic clause-presence rules.
 *
 * 100% local, regex-based (no network calls), following the exact precedent
 * of extractors.ts's field-extraction RULES — but here each rule answers a
 * yes/no "is this standard clause present in the contract text?" question
 * instead of extracting a field value. `clauseKey` matches (by convention,
 * not a DB foreign key) a row in public.contract_standard_clause_library —
 * that table carries the human-facing metadata (category, severity,
 * applies_to); this file carries the matching logic, mirroring how
 * document_type_registry (DB) and extractors.ts (TS) are already split.
 *
 * This is the tier that works with ZERO AI configuration — always runs, and
 * is never replaced (only enriched) by the optional AI tier in
 * contract-intelligence-ai.ts.
 */

export type ClauseRule = {
  clauseKey: string;
  patterns: RegExp[];
};

export const CLAUSE_RULES: ClauseRule[] = [
  { clauseKey: "payment_terms", patterns: [/payment\s+terms?/i, /terms?\s+of\s+payment/i, /net\s+\d{1,3}\s+days/i, /payment\s+shall\s+be\s+made/i] },
  { clauseKey: "termination", patterns: [/termination\s+of\s+(?:this\s+)?(?:agreement|contract)/i, /\bmay\s+terminate\b/i, /right\s+to\s+terminate/i, /this\s+agreement\s+(?:may\s+be\s+|shall\s+)?terminat/i] },
  { clauseKey: "auto_renewal", patterns: [/automatically\s+renew/i, /auto[\s-]?renew/i, /shall\s+renew\s+for\s+(?:a\s+)?(?:further|additional)/i, /renew(?:s|ed)?\s+for\s+(?:successive|consecutive)/i] },
  { clauseKey: "notice_period", patterns: [/notice\s+period/i, /(\d{1,3})\s*(?:days?|months?)\'?\s*(?:prior\s+)?(?:written\s+)?notice/i, /written\s+notice\s+of\s+(?:not\s+less\s+than\s+)?(\d{1,3})/i] },
  { clauseKey: "force_majeure", patterns: [/force\s+majeure/i, /acts?\s+of\s+god/i, /beyond\s+(?:the\s+)?(?:reasonable\s+)?control\s+of\s+(?:either\s+)?party/i] },
  { clauseKey: "confidentiality", patterns: [/confidential(?:ity)?\s+(?:information|clause|obligations?)/i, /non[\s-]?disclosure/i, /shall\s+keep\s+confidential/i] },
  { clauseKey: "indemnity", patterns: [/indemnif(?:y|ication)/i, /hold\s+harmless/i, /shall\s+indemnify/i] },
  { clauseKey: "liability_cap", patterns: [/limit(?:ation)?\s+of\s+liability/i, /liability\s+shall\s+not\s+exceed/i, /aggregate\s+liability/i, /maximum\s+liability/i] },
  { clauseKey: "dispute_resolution", patterns: [/dispute\s+resolution/i, /arbitration/i, /mediation/i, /courts?\s+of\s+.{0,30}\s+shall\s+have\s+(?:exclusive\s+)?jurisdiction/i] },
  { clauseKey: "governing_law", patterns: [/governing\s+law/i, /governed\s+by\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?the\s+laws?\s+of/i, /applicable\s+law/i] },
  { clauseKey: "delivery_obligations", patterns: [/delivery\s+(?:schedule|obligations?|terms?|date)/i, /shall\s+deliver/i, /(?:incoterms?|fob|cif|cfr|exw|ddp)\b/i] },
  { clauseKey: "penalty_late_fee", patterns: [/late\s+(?:payment\s+)?(?:fee|penalty|charge)/i, /penalty\s+(?:clause|of|for)/i, /liquidated\s+damages/i] },
  { clauseKey: "assignment", patterns: [/assignment\s+(?:of\s+(?:this\s+)?(?:agreement|contract)|clause)/i, /shall\s+not\s+assign/i, /without\s+(?:the\s+)?(?:prior\s+)?written\s+consent.{0,20}assign/i] },
  { clauseKey: "warranty", patterns: [/warrant(?:y|ies|s)/i, /guarantee\s+of\s+quality/i, /warrants?\s+that/i] },
  { clauseKey: "ip_ownership", patterns: [/intellectual\s+property/i, /ownership\s+of\s+(?:all\s+)?(?:work\s+product|deliverables)/i, /\b(?:copyright|trademark|patent)\s+(?:rights?|ownership)/i] },
  { clauseKey: "probation_period", patterns: [/probation(?:ary)?\s+period/i, /probation\s+of\s+\d+/i] },
  { clauseKey: "leave_entitlement", patterns: [/annual\s+leave/i, /leave\s+entitlement/i, /sick\s+leave/i, /vacation\s+(?:days?|entitlement)/i] },
  { clauseKey: "salary_terms", patterns: [/monthly\s+salary/i, /basic\s+salary/i, /salary\s+shall\s+be/i, /gross\s+salary/i] },
];

/** Renewal-notice-period days, if a number is present near the notice-period pattern. */
export function extractNoticePeriodDays(text: string): number | null {
  const m = text.match(/(\d{1,3})\s*(?:days?|months?)\'?\s*(?:prior\s+)?(?:written\s+)?notice/i)
    || text.match(/written\s+notice\s+of\s+(?:not\s+less\s+than\s+)?(\d{1,3})\s*(?:days?|months?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function detectClausePresence(fullText: string): Map<string, { present: boolean; excerpt: string | null }> {
  const result = new Map<string, { present: boolean; excerpt: string | null }>();
  for (const rule of CLAUSE_RULES) {
    let excerpt: string | null = null;
    for (const pattern of rule.patterns) {
      const match = fullText.match(pattern);
      if (match && typeof match.index === "number") {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(fullText.length, match.index + match[0].length + 80);
        excerpt = fullText.slice(start, end).replace(/\s+/g, " ").trim();
        break;
      }
    }
    result.set(rule.clauseKey, { present: excerpt !== null, excerpt });
  }
  return result;
}

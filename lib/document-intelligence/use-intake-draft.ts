"use client";

/**
 * useIntakeDraft — the single, reusable bridge between an AI Document Intake
 * reviewed draft and a real ERP entry form.
 *
 *   Entry Method Selector → "Continue Saved Draft"  (stashes the draft in
 *   sessionStorage under DRAFT_PREFILL_KEY)
 *        ↓
 *   the target form calls  useIntakeDraft("companies")  on mount
 *        ↓
 *   { payload, goodsEntries, linkedSourceId, linkMode, draftNo }  →  prefill the form
 *        ↓
 *   after the form's own save succeeds:  draft.consume(createdRecordId)
 *        ↓
 *   the draft is marked 'consumed' and the intake job becomes 'linked' (audit).
 *
 * The AI still never posts — the form runs all its own validation / serials /
 * approval / accounting. This hook only carries the reviewed values across and
 * records that the draft was used.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiPatch } from "@/lib/api/client";
import {
  readDraftPrefill,
  clearDraftPrefill,
  type EntryDraft,
} from "@/features/document-intelligence/components/entry-method-selector";

export type IntakeDraftState = {
  /** null until a draft was chosen for this module */
  draft: EntryDraft | null;
  /** field values the extractor mapped for this module's form */
  payload: Record<string, any>;
  /** line items (goods) when the target module has them */
  goodsEntries: any[];
  /** the human's link decision from the review screen */
  linkMode: "new_record" | "append_existing" | null;
  /** existing master/source record the draft is linked to (Update / Link path) */
  linkedSourceId: string | null;
  draftNo: string | null;
  draftId: string | null;
  /** call after the form's real save; idempotent server-side */
  consume: (createdSourceId: string) => Promise<void>;
  consumed: boolean;
  consumeError: string | null;
};

export function useIntakeDraft(targetModule: string): IntakeDraftState {
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [consumed, setConsumed] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const readOnce = useRef(false);

  useEffect(() => {
    if (readOnce.current) return;
    readOnce.current = true;
    let d: EntryDraft | null = null;
    try { d = readDraftPrefill(targetModule); } catch { d = null; }
    if (d) {
      setDraft(d);
      clearDraftPrefill();
    }
  }, [targetModule]);

  const consume = useCallback(
    async (createdSourceId: string) => {
      const id = draft?.draftId;
      if (!id || !createdSourceId) return;
      try {
        await apiPatch(`/api/erp/document-intelligence/drafts/${id}`, {
          action: "consume",
          createdSourceModule: targetModule,
          createdSourceId,
        });
        setConsumed(true);
        setConsumeError(null);
      } catch (e) {
        // A failed consume must NOT fail the user's save — the record exists.
        setConsumeError(e instanceof Error ? e.message : String(e));
      }
    },
    [draft?.draftId, targetModule],
  );

  return {
    draft,
    payload: (draft?.payload as Record<string, any>) ?? {},
    goodsEntries: Array.isArray(draft?.goodsEntries) ? (draft!.goodsEntries as any[]) : [],
    linkMode: (draft?.linkMode as IntakeDraftState["linkMode"]) ?? null,
    linkedSourceId: (draft?.linkedSourceId as string | null) ?? null,
    draftNo: (draft?.draftNo as string | null) ?? null,
    draftId: (draft?.draftId as string | null) ?? null,
    consume,
    consumed,
    consumeError,
  };
}

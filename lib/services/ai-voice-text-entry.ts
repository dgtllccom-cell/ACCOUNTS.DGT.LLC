import crypto from "node:crypto";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { IntakeScope, OperationalDomain } from "@/lib/document-intelligence/scope";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { DocumentValidationError } from "@/lib/document-intelligence/storage";
import { validateAudio, saveVoiceAudio } from "@/lib/services/voice-audio-storage";

function audioExt(mime?: string | null): string {
  if (!mime) return "webm";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

/** withLocalPg resolves to null when DATABASE_URL is not configured. These
 *  workflow mutations must never silently no-op, so surface that as an error. */
async function unwrapDb<T>(p: Promise<T | null>): Promise<T> {
  const value = await p;
  if (value == null) {
    throw new DocumentValidationError("Database connection is not configured on the server.");
  }
  return value;
}

/**
 * AI Voice & Text Entry Service
 *
 * Extends the existing Document Intelligence system to support:
 * 1. Voice message input (speech-to-text)
 * 2. Typed text/AI instruction input
 * 3. Preserves original language and transcript
 * 4. Converts to structured AI draft via existing matching/draft mapping
 * 5. Routes to approval workflow (not direct posting)
 */

export type VoiceTextInput = {
  operationalDomain: OperationalDomain;
  sourceType: "voice" | "text";
  originalLanguage: SupportedLanguage;
  transcript: string;
  audioBuffer?: Buffer; // Voice only
  audioMimeType?: string | null;
  audioDurationSeconds?: number;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  clearingAgentId?: string | null;
  companyId?: string | null;
  sourceModuleHint?: string | null;
  idempotencyKey?: string | null;
};

export type VoiceSession = {
  id: string;
  sessionToken: string;
  userId: string;
  operationalDomain: OperationalDomain;
  language: SupportedLanguage;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  clearingAgentId?: string | null;
  status: "active" | "completed" | "abandoned" | "error";
  startTime: Date;
  endTime?: Date | null;
  totalAudioDurationSeconds: number;
  totalMessagesRecorded: number;
};

export type ApprovalWorkflow = {
  id: string;
  documentIntakeJobId: string;
  status: "pending" | "approved" | "rejected" | "returned_for_review";
  submittedBy: string;
  submittedAt: Date;
  reviewerId?: string | null;
  reviewedAt?: Date | null;
  reviewerNotes?: string | null;
  approverId?: string | null;
  approvedAt?: Date | null;
  approverNotes?: string | null;
  rejectionReason?: string | null;
  returnedReason?: string | null;
  finalErpTransactionId?: string | null;
  finalVoucherNo?: string | null;
  finalSerialReferences?: Record<string, any>;
};

export class AiVoiceTextEntryService {
  /**
   * Create a new voice/text entry session.
   * Returns a session token for the client to use during recording/typing.
   */
  async createVoiceSession(
    userId: string,
    operationalDomain: OperationalDomain,
    language: SupportedLanguage,
    countryId?: string | null,
    countryBranchId?: string | null,
    cityBranchId?: string | null,
    clearingAgentId?: string | null,
  ): Promise<VoiceSession | null> {
    const sessionToken = crypto.randomBytes(32).toString("hex");

    return withLocalPg(async (sql) => {
      const [result] = await sql`
        INSERT INTO public.voice_entry_sessions
          (user_id, session_token, operational_domain, country_id, country_branch_id,
           city_branch_id, clearing_agent_id, language, status)
        VALUES
          (${userId}, ${sessionToken}, ${operationalDomain}, ${countryId ?? null},
           ${countryBranchId ?? null}, ${cityBranchId ?? null}, ${clearingAgentId ?? null},
           ${language}, 'active')
        RETURNING
          id, session_token, user_id, operational_domain, country_id, country_branch_id,
          city_branch_id, clearing_agent_id, language, status, start_time, end_time,
          total_audio_duration_seconds, total_messages_recorded
      `;

      return {
        id: result.id,
        sessionToken: result.session_token,
        userId: result.user_id,
        operationalDomain: result.operational_domain,
        language: result.language,
        countryId: result.country_id,
        countryBranchId: result.country_branch_id,
        cityBranchId: result.city_branch_id,
        clearingAgentId: result.clearing_agent_id,
        status: result.status,
        startTime: result.start_time,
        endTime: result.end_time,
        totalAudioDurationSeconds: result.total_audio_duration_seconds,
        totalMessagesRecorded: result.total_messages_recorded,
      };
    });
  }

  /**
   * Complete a voice/text entry session.
   */
  async completeVoiceSession(sessionId: string): Promise<void> {
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.voice_entry_sessions
        SET status = 'completed', end_time = now(), updated_at = now()
        WHERE id = ${sessionId} AND status = 'active'
      `;
    });
  }

  /**
   * Submit voice or text input for AI processing.
   * Creates a document_intake_job with source_type='voice' or 'text'.
   * Returns job ID for tracking through approval workflow.
   */
  async submitVoiceTextInput(
    input: VoiceTextInput,
    userId: string,
    userName: string | null,
    scope: IntakeScope,
  ): Promise<{ jobId: string; jobNo: string; audioStorageKey?: string | null } | null> {
    // Validate scope
    if (scope.domain && scope.domain !== input.operationalDomain) {
      throw new DocumentValidationError(
        `Your login is restricted to the ${scope.domain} domain.`,
      );
    }

    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) {
      throw new DocumentValidationError("Country is outside your assigned scope.");
    }

    // Validate transcript
    if (!input.transcript || input.transcript.trim().length === 0) {
      throw new DocumentValidationError("Transcript cannot be empty.");
    }

    if (input.transcript.length > 50000) {
      throw new DocumentValidationError("Transcript exceeds maximum length (50,000 characters).");
    }

    // Validate audio (voice only)
    if (input.sourceType === "voice") {
      if (!input.audioBuffer || input.audioBuffer.length === 0) {
        throw new DocumentValidationError("Audio buffer is required for voice input.");
      }
      if (input.audioBuffer.length > 100 * 1024 * 1024) {
        // 100MB max
        throw new DocumentValidationError("Audio file exceeds maximum size (100 MB).");
      }
      if (!input.audioDurationSeconds || input.audioDurationSeconds < 1) {
        throw new DocumentValidationError("Audio duration must be at least 1 second.");
      }
    }

    return withLocalPg(async (sql) => {
      // Idempotency check
      if (input.idempotencyKey) {
        const existing = await sql`
          SELECT id, job_no FROM public.document_intake_jobs
          WHERE idempotency_key = ${input.idempotencyKey} AND deleted_at IS NULL
          LIMIT 1
        `;
        if (existing?.length) {
          return { jobId: existing[0].id, jobNo: existing[0].job_no };
        }
      }

      // Generate job number
      const seq = (await sql`SELECT count(*)::int n FROM public.document_intake_jobs`)?.[0]?.n ?? 0;
      const jobNo = `AI-${new Date().getUTCFullYear()}-${String(seq + 1).padStart(5, "0")}`;

      const audioMime = input.audioMimeType ?? (input.sourceType === "voice" ? "audio/webm" : null);
      const originalFilename =
        input.sourceType === "voice" ? `voice-message.${audioExt(audioMime)}` : "text-instruction.txt";

      // Create document intake job with voice/text source. audio_storage_key is
      // filled in immediately after, once we have the real job id.
      const [result] = await sql`
        INSERT INTO public.document_intake_jobs
          (job_no, operational_domain, company_id, country_id, country_branch_id, city_branch_id,
           clearing_agent_id, source_module_hint, source_type, original_language,
           transcript, audio_duration_seconds, audio_mime_type, audio_storage_key,
           uploaded_by, uploaded_by_name, upload_method, original_filename, mime_type,
           file_size, storage_key, file_sha256, status, idempotency_key)
        VALUES
          (${jobNo}, ${input.operationalDomain}, ${input.companyId ?? null},
           ${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null},
           ${input.clearingAgentId ?? null}, ${input.sourceModuleHint ?? null},
           ${input.sourceType}, ${input.originalLanguage},
           ${input.transcript}, ${input.audioDurationSeconds ?? null},
           ${audioMime}, ${"__pending__"},
           ${userId}, ${userName},
           ${"web"},
           ${originalFilename},
           ${input.sourceType === "voice" ? (audioMime ?? "audio/webm") : "text/plain"},
           ${input.audioBuffer?.length ?? input.transcript.length},
           ${"__pending__"},
           ${crypto.createHash("sha256").update(input.transcript).digest("hex")},
           'review', ${input.idempotencyKey ?? null})
        RETURNING id, job_no
      `;

      // Persist the real audio blob to private storage, keyed by the job id.
      let audioStorageKey: string | null = null;
      if (input.sourceType === "voice" && input.audioBuffer?.length) {
        const validated = validateAudio(input.audioBuffer, audioMime);
        audioStorageKey = await saveVoiceAudio(result.id, validated);
        await sql`
          UPDATE public.document_intake_jobs
          SET audio_storage_key = ${audioStorageKey},
              storage_key = ${audioStorageKey},
              audio_mime_type = ${validated.mime},
              file_size = ${validated.size},
              updated_at = now()
          WHERE id = ${result.id}
        `;
      } else {
        await sql`
          UPDATE public.document_intake_jobs
          SET audio_storage_key = NULL, storage_key = ${`text/${result.id}.txt`}, updated_at = now()
          WHERE id = ${result.id}
        `;
      }

      return { jobId: result.id, jobNo: result.job_no, audioStorageKey };
    });
  }

  /**
   * Create an approval workflow for a document intake job.
   * The job must be in 'draft_ready' status.
   */
  async createApprovalWorkflow(jobId: string, userId: string): Promise<ApprovalWorkflow | null> {
    return withLocalPg(async (sql) => {
      // Verify job exists and is draft-ready
      const job = await sql`
        SELECT id, status FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL
      `;
      if (!job?.length) {
        throw new DocumentValidationError("Job not found.");
      }

      const [workflow] = await sql`
        INSERT INTO public.approval_workflows
          (document_intake_job_id, status, submitted_by, submitted_at)
        VALUES
          (${jobId}, 'pending', ${userId}, now())
        RETURNING
          id, document_intake_job_id, status, submitted_by, submitted_at,
          reviewer_id, reviewed_at, reviewer_notes, approver_id, approved_at,
          approver_notes, rejection_reason, rejected_at, returned_reason, returned_at,
          final_erp_transaction_id, final_voucher_no, final_serial_references
      `;

      return {
        id: workflow.id,
        documentIntakeJobId: workflow.document_intake_job_id,
        status: workflow.status,
        submittedBy: workflow.submitted_by,
        submittedAt: workflow.submitted_at,
        reviewerId: workflow.reviewer_id,
        reviewedAt: workflow.reviewed_at,
        reviewerNotes: workflow.reviewer_notes,
        approverId: workflow.approver_id,
        approvedAt: workflow.approved_at,
        approverNotes: workflow.approver_notes,
        rejectionReason: workflow.rejection_reason,
        returnedReason: workflow.returned_reason,
        finalErpTransactionId: workflow.final_erp_transaction_id,
        finalVoucherNo: workflow.final_voucher_no,
        finalSerialReferences: workflow.final_serial_references,
      };
    });
  }

  /**
   * Approve an AI draft workflow.
   * This is where the draft converts to a real ERP transaction.
   */
  async approveWorkflow(
    workflowId: string,
    approverId: string,
    approverNotes?: string,
  ): Promise<ApprovalWorkflow> {
    const result = await withLocalPg(async (sql): Promise<ApprovalWorkflow | null> => {
      const [workflow] = await sql`
        UPDATE public.approval_workflows
        SET status = 'approved', approver_id = ${approverId}, approved_at = now(),
            approver_notes = ${approverNotes ?? null}, updated_at = now()
        WHERE id = ${workflowId} AND status IN ('pending', 'returned_for_review')
        RETURNING
          id, document_intake_job_id, status, submitted_by, submitted_at,
          reviewer_id, reviewed_at, reviewer_notes, approver_id, approved_at,
          approver_notes, rejection_reason, rejected_at, returned_reason, returned_at,
          final_erp_transaction_id, final_voucher_no, final_serial_references
      `;

      if (!workflow) return null;

      return {
        id: workflow.id,
        documentIntakeJobId: workflow.document_intake_job_id,
        status: workflow.status,
        submittedBy: workflow.submitted_by,
        submittedAt: workflow.submitted_at,
        reviewerId: workflow.reviewer_id,
        reviewedAt: workflow.reviewed_at,
        reviewerNotes: workflow.reviewer_notes,
        approverId: workflow.approver_id,
        approvedAt: workflow.approved_at,
        approverNotes: workflow.approver_notes,
        rejectionReason: workflow.rejection_reason,
        returnedReason: workflow.returned_reason,
        finalErpTransactionId: workflow.final_erp_transaction_id,
        finalVoucherNo: workflow.final_voucher_no,
        finalSerialReferences: workflow.final_serial_references,
      } satisfies ApprovalWorkflow;
    });
    if (!result) throw new DocumentValidationError("Workflow not found or cannot be approved in current state.");
    return result;
  }

  /**
   * Reject an AI draft workflow with a reason.
   */
  async rejectWorkflow(
    workflowId: string,
    rejectionReason: string,
  ): Promise<ApprovalWorkflow> {
    const result = await withLocalPg(async (sql): Promise<ApprovalWorkflow | null> => {
      const [workflow] = await sql`
        UPDATE public.approval_workflows
        SET status = 'rejected', rejection_reason = ${rejectionReason},
            rejected_at = now(), updated_at = now()
        WHERE id = ${workflowId} AND status = 'pending'
        RETURNING
          id, document_intake_job_id, status, submitted_by, submitted_at,
          reviewer_id, reviewed_at, reviewer_notes, approver_id, approved_at,
          approver_notes, rejection_reason, rejected_at, returned_reason, returned_at,
          final_erp_transaction_id, final_voucher_no, final_serial_references
      `;

      if (!workflow) return null;

      return {
        id: workflow.id,
        documentIntakeJobId: workflow.document_intake_job_id,
        status: workflow.status,
        submittedBy: workflow.submitted_by,
        submittedAt: workflow.submitted_at,
        reviewerId: workflow.reviewer_id,
        reviewedAt: workflow.reviewed_at,
        reviewerNotes: workflow.reviewer_notes,
        approverId: workflow.approver_id,
        approvedAt: workflow.approved_at,
        approverNotes: workflow.approver_notes,
        rejectionReason: workflow.rejection_reason,
        returnedReason: workflow.returned_reason,
        finalErpTransactionId: workflow.final_erp_transaction_id,
        finalVoucherNo: workflow.final_voucher_no,
        finalSerialReferences: workflow.final_serial_references,
      } satisfies ApprovalWorkflow;
    });
    if (!result) throw new DocumentValidationError("Workflow not found or cannot be rejected in current state.");
    return result;
  }

  /**
   * Return a draft for review/correction.
   */
  async returnForReview(
    workflowId: string,
    returnReason: string,
  ): Promise<ApprovalWorkflow> {
    const result = await withLocalPg(async (sql): Promise<ApprovalWorkflow | null> => {
      const [workflow] = await sql`
        UPDATE public.approval_workflows
        SET status = 'returned_for_review', returned_reason = ${returnReason},
            returned_at = now(), updated_at = now()
        WHERE id = ${workflowId} AND status = 'pending'
        RETURNING
          id, document_intake_job_id, status, submitted_by, submitted_at,
          reviewer_id, reviewed_at, reviewer_notes, approver_id, approved_at,
          approver_notes, rejection_reason, rejected_at, returned_reason, returned_at,
          final_erp_transaction_id, final_voucher_no, final_serial_references
      `;

      if (!workflow) return null;

      return {
        id: workflow.id,
        documentIntakeJobId: workflow.document_intake_job_id,
        status: workflow.status,
        submittedBy: workflow.submitted_by,
        submittedAt: workflow.submitted_at,
        reviewerId: workflow.reviewer_id,
        reviewedAt: workflow.reviewed_at,
        reviewerNotes: workflow.reviewer_notes,
        approverId: workflow.approver_id,
        approvedAt: workflow.approved_at,
        approverNotes: workflow.approver_notes,
        rejectionReason: workflow.rejection_reason,
        returnedReason: workflow.returned_reason,
        finalErpTransactionId: workflow.final_erp_transaction_id,
        finalVoucherNo: workflow.final_voucher_no,
        finalSerialReferences: workflow.final_serial_references,
      } satisfies ApprovalWorkflow;
    });
    if (!result) throw new DocumentValidationError("Workflow not found or cannot be returned in current state.");
    return result;
  }
}

export const aiVoiceTextEntryService = new AiVoiceTextEntryService();

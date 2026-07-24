import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { appendCountryEmailSignature, resolveCountryEmailConfig } from "@/lib/email/country-email-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmailDirect } from "@/lib/email/smtp-client";
import { decrypt } from "@/lib/crypto";

const querySchema = z.object({
  channel: z.enum(["email", "whatsapp", "internal", "notifications"]).default("email")
});

const composeSchema = z.object({
  channel: z.enum(["email", "whatsapp", "internal", "notifications"]).default("email"),
  folder: z.enum(["draft", "sent"]).default("sent"),
  provider: z.string().trim().min(1).max(80).optional(),
  to: z.string().trim().max(500).optional(),
  cc: z.string().trim().max(500).optional(),
  bcc: z.string().trim().max(500).optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  companyId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  countryId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  countryBranchId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  cityBranchId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  linkedRoute: z.string().trim().max(255).optional(),
  linkedModule: z.string().trim().max(80).optional(),
  linkedDocumentNo: z.string().trim().max(100).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(50)).optional(),
  attachments: z.array(
    z.object({
      filename: z.string(),
      content: z.string(), // base64
      contentType: z.string().optional()
    })
  ).optional()
});

type AuditRow = {
  id: string;
  company_id: string | null;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

type DraftPurchaseOrderRow = {
  id: string;
  purchase_order_no: string;
  purchase_contract_no: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  supplier_company_id: string | null;
  companies: { name: string | null } | { name: string | null }[] | null;
  currency_code: string;
  exchange_rate: string | number;
  order_total: string | number;
  payment_status: string | null;
  ledger_posting_status: string | null;
  created_at: string;
  updated_at: string;
};

type DraftJournalEntryRow = {
  id: string;
  entry_no: string;
  company_id: string | null;
  branch_id: string | null;
  status: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type DraftTransactionRow = {
  id: string;
  transaction_no: string;
  country_id: string | null;
  city_branch_id: string | null;
  status: string | null;
  description: string | null;
  local_currency: string;
  local_amount: string | number;
  created_at: string;
  updated_at: string;
};

type DraftRoznamchaRow = {
  id: string;
  journal_no: string | null;
  voucher_no: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  type: string | null;
  status: string | null;
  narration: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  user_code: string | null;
  default_company_id: string | null;
};

type SimpleRow = { id: string; name: string | null };

type CountryRow = { id: string; name: string; iso2: string | null; official_email?: string | null; admin_email?: string | null; email_domain?: string | null; email_server_settings?: Record<string, unknown> | null };
type CountryBranchRow = { id: string; name: string; code: string; country_id: string; local_currency: string; status: string; email?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; country_id: string; country_branch_id: string; local_currency: string; status: string; email?: string | null };

type EmailDbRow = {
  id: string;
  channel: "email" | "whatsapp" | "internal" | "notifications";
  folder: MessageFolder;
  provider_id: string | null;
  email_account_id: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  customer_id: string | null;
  sender_user_id: string | null;
  sender_name: string;
  sender_email: string | null;
  recipient_to: string;
  recipient_cc: string;
  subject: string;
  body: string;
  labels: string[] | null;
  attachment_count: number | null;
  attachments: unknown;
  delivery_status: string | null;
  direction: "incoming" | "outgoing" | "internal";
  linked_module: string | null;
  linked_route: string | null;
  linked_document_no: string | null;
  created_at: string;
};

type MessageFolder = "inbox" | "sent" | "draft" | "trash" | "spam" | "attachments" | "notifications";

type MessageRow = {
  id: string;
  folder: MessageFolder;
  channel: "email" | "whatsapp" | "internal" | "notifications";
  provider: string;
  subject: string;
  preview: string;
  body: string;
  senderName: string;
  senderEmail: string | null;
  recipientSummary: string;
  ccSummary: string;
  companyId: string | null;
  companyName: string;
  branchId: string | null;
  branchName: string;
  branchType: string;
  createdAt: string;
  status: "draft" | "sent" | "received";
  isUnread: boolean;
  labels: string[];
  attachmentCount: number;
  linkedModule: string | null;
  linkedRoute: string | null;
  linkedDocumentNo: string | null;
  sourceTable: string;
  sourceId: string | null;
  action: string;
  companyFilterKey: string;
  branchFilterKey: string;
};

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function titleCase(input: string) {
  return input
    .split(/[_\-. ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function messageFolderFor(action: string, after: any): MessageFolder {
  const folder = String(after?.folder ?? "").toLowerCase();
  if (folder === "draft") return "draft";
  if (folder === "trash") return "trash";
  if (folder === "spam") return "spam";
  if (folder === "attachments") return "attachments";
  if (folder === "notifications") return "notifications";
  if (action.startsWith("message.draft")) return "draft";
  if (action.startsWith("message.send") || action.startsWith("message.reply") || action.startsWith("message.forward")) return "sent";
  if (action.startsWith("message.trash")) return "trash";
  if (action.startsWith("message.spam")) return "spam";
  if (action.startsWith("erp.notification") || action.startsWith("auth.login") || action.startsWith("users.") || action.startsWith("companies.") || action.startsWith("countries.") || action.startsWith("country_branches.") || action.startsWith("city_branches.") || action.startsWith("accounts.") || action.startsWith("journal_entries.") || action.startsWith("transactions.") || action.startsWith("purchases.") || action.startsWith("roznamcha.") || action.startsWith("approvals.")) {
    return "inbox";
  }
  return "notifications";
}

function messageStatus(folder: MessageFolder, action: string) {
  if (folder === "draft") return "draft" as const;
  if (action.startsWith("message.send")) return "sent" as const;
  return "received" as const;
}

function deriveLinkedRoute(entityTable: string, sourceTable: string) {
  const table = (entityTable || sourceTable || "").toLowerCase();
  if (table.includes("purchase_order")) return "/dashboard/purchase/purchase-order";
  if (table.includes("purchase")) return "/dashboard/purchase/purchase-order";
  if (table.includes("roznamcha")) return "/dashboard/roznamcha/super-admin";
  if (table.includes("journal")) return "/dashboard/ledger/super-admin";
  if (table.includes("transaction")) return "/dashboard/ledger/branch";
  if (table.includes("user")) return "/dashboard/new-entry/users/registration";
  if (table.includes("country_branch") || table.includes("city_branch") || table.includes("branch")) return "/dashboard/branch-management/general-report";
  if (table.includes("company")) return "/dashboard/settings/company";
  if (table.includes("customer")) return "/dashboard/settings/customers";
  if (table.includes("attachment")) return "/dashboard/documents";
  return null;
}

function deriveLinkedModule(entityTable: string, sourceTable: string) {
  const table = (entityTable || sourceTable || "").toLowerCase();
  if (table.includes("purchase")) return "Purchase";
  if (table.includes("roznamcha")) return "Roznamcha";
  if (table.includes("journal")) return "Ledger";
  if (table.includes("transaction")) return "Payments";
  if (table.includes("user")) return "Users";
  if (table.includes("country_branch") || table.includes("city_branch") || table.includes("branch")) return "Branch";
  if (table.includes("company")) return "Company";
  if (table.includes("customer")) return "Customer";
  return "ERP";
}

function deriveSubject(action: string, entityTable: string, after: any, before: any, fallbackNo?: string | null) {
  const subject = safeText(after?.subject || after?.title || after?.name || after?.message || before?.subject || before?.title || before?.name);
  if (subject) return subject;

  const docNo = safeText(
    after?.documentNo ||
      after?.document_no ||
      after?.purchase_order_no ||
      after?.journal_no ||
      after?.voucher_no ||
      after?.entry_no ||
      after?.transaction_no ||
      fallbackNo
  );
  if (docNo) return `${titleCase(entityTable || action)} ${docNo}`.trim();
  return titleCase(action.replace(/^message\./, "").replace(/^erp\.notification\./, "")) || titleCase(entityTable || "Message");
}

function derivePreview(action: string, entityTable: string, after: any, before: any) {
  const preview = safeText(after?.preview || after?.body || after?.description || after?.narration || after?.memo || before?.preview || before?.body || before?.description || before?.narration || before?.memo);
  if (preview) return preview.slice(0, 220);
  return `ERP ${titleCase(entityTable || action)} activity recorded at ${new Date().toLocaleString()}`;
}

function scopeLabel(countryId: string | null, countryName: string | null, branchType: string, branchName: string) {
  if (branchType && branchType !== "Global") return `${countryName ?? "Country"} / ${branchName}`;
  if (countryId) return countryName ?? "Country";
  return "Global";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function firstScope<T>(values: T[]) {
  return values.length ? values[0]! : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      channel: request.nextUrl.searchParams.get("channel") ?? undefined
    });

    const admin = createSupabaseAdminClient() as any;

    const [profileRes, auditRes, emailMessagesRes, purchaseDraftsRes, journalDraftsRes, transactionDraftsRes, roznamchaDraftsRes, attachmentRes, companiesRes, countriesRes, countryBranchesRes, cityBranchesRes] =
      await Promise.all([
        admin.from("profiles").select("id, full_name, user_code, default_company_id").eq("id", session.userId).maybeSingle(),
        admin.from("audit_logs").select("id, company_id, actor_id, action, entity_table, entity_id, before, after, created_at").order("created_at", { ascending: false }).limit(400),
        admin
          .from("erp_email_messages")
          .select(
            "id, channel, folder, provider_id, email_account_id, country_id, country_branch_id, city_branch_id, customer_id, sender_user_id, sender_name, sender_email, recipient_to, recipient_cc, subject, body, labels, attachment_count, attachments, delivery_status, direction, linked_module, linked_route, linked_document_no, created_at"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500),
        admin
          .from("purchase_orders")
          .select("id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, supplier_company_id, companies(name), currency_code, exchange_rate, order_total, payment_status, ledger_posting_status, created_at, updated_at")
          .in("ledger_posting_status", ["draft", "pending"])
          .order("created_at", { ascending: false })
          .limit(40),
        admin
          .from("journal_entries")
          .select("id, entry_no, company_id, branch_id, status, memo, created_at, updated_at")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(30),
        admin
          .from("transactions")
          .select("id, transaction_no, country_id, city_branch_id, status, description, local_currency, local_amount, created_at, updated_at")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(30),
        admin
          .from("roznamcha_entries")
          .select("id, journal_no, voucher_no, country_id, country_branch_id, city_branch_id, type, status, narration, created_at, updated_at")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(30),
        admin.from("attachments").select("id, company_id, owner_table, owner_id, bucket, path, created_at").order("created_at", { ascending: false }).limit(100),
        admin.from("companies").select("id, name").order("name", { ascending: true }),
        admin.from("countries").select("id, name, iso2, official_email, admin_email, email_domain").order("name", { ascending: true }),
        admin.from("country_branches").select("id, name, code, country_id, local_currency, status, email").order("name", { ascending: true }),
        admin.from("city_branches").select("id, name, code, city_name, country_id, country_branch_id, local_currency, status, email").order("city_name", { ascending: true })
      ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (auditRes.error) throw new Error(auditRes.error.message);
    const emailMessages = emailMessagesRes.error ? [] : ((emailMessagesRes.data ?? []) as EmailDbRow[]);
    if (purchaseDraftsRes.error) throw new Error(purchaseDraftsRes.error.message);
    if (journalDraftsRes.error) throw new Error(journalDraftsRes.error.message);
    if (transactionDraftsRes.error) throw new Error(transactionDraftsRes.error.message);
    if (roznamchaDraftsRes.error) throw new Error(roznamchaDraftsRes.error.message);
    if (attachmentRes.error) throw new Error(attachmentRes.error.message);
    if (companiesRes.error) throw new Error(companiesRes.error.message);
    if (countriesRes.error) throw new Error(countriesRes.error.message);
    if (countryBranchesRes.error) throw new Error(countryBranchesRes.error.message);
    if (cityBranchesRes.error) throw new Error(cityBranchesRes.error.message);

    const profile = profileRes.data as ProfileRow | null;
    const defaultCompanyId = profile?.default_company_id ?? null;
    const auditRows = (auditRes.data ?? []) as AuditRow[];
    const auditActorIds = [...new Set(auditRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
    const draftActorIds = [
      ...(journalDraftsRes.data ?? []).map((row: DraftJournalEntryRow) => row.company_id ?? null),
      ...(purchaseDraftsRes.data ?? []).map((row: DraftPurchaseOrderRow) => row.supplier_company_id ?? null)
    ].filter((id): id is string => Boolean(id));
    const profileIds = [...new Set([...auditActorIds, ...draftActorIds])];

    const actorProfilesRes =
      profileIds.length > 0
        ? await admin.from("profiles").select("id, full_name, user_code").in("id", profileIds)
        : { data: [], error: null };
    if ((actorProfilesRes as any).error) throw new Error((actorProfilesRes as any).error.message);

    const actorProfiles = ((actorProfilesRes as any).data ?? []) as ProfileRow[];
    const actorLookup = new Map(actorProfiles.map((row) => [row.id, row] as const));
    const companyLookup = new Map(((companiesRes.data ?? []) as SimpleRow[]).map((row) => [row.id, row] as const));
    const countryLookup = new Map(((countriesRes.data ?? []) as CountryRow[]).map((row) => [row.id, row] as const));
    const countryBranchLookup = new Map(((countryBranchesRes.data ?? []) as CountryBranchRow[]).map((row) => [row.id, row] as const));
    const cityBranchLookup = new Map(((cityBranchesRes.data ?? []) as CityBranchRow[]).map((row) => [row.id, row] as const));

    function resolveScope(countryId: string | null, countryBranchId: string | null, cityBranchId: string | null) {
      const cityBranch = cityBranchId ? cityBranchLookup.get(cityBranchId) ?? null : null;
      const countryBranch = countryBranchId
        ? countryBranchLookup.get(countryBranchId) ?? null
        : cityBranch?.country_branch_id
          ? countryBranchLookup.get(cityBranch.country_branch_id) ?? null
          : null;
      return {
        countryId: countryId ?? cityBranch?.country_id ?? countryBranch?.country_id ?? null,
        countryBranchId: countryBranchId ?? cityBranch?.country_branch_id ?? null,
        cityBranchId
      };
    }

    function canSeeScope(countryId: string | null, countryBranchId: string | null, cityBranchId: string | null) {
      if (session.isSuperAdmin) return true;
      const resolved = resolveScope(countryId, countryBranchId, cityBranchId);
      if (session.cityBranchIds.length) return Boolean(resolved.cityBranchId && session.cityBranchIds.includes(resolved.cityBranchId));
      if (session.countryBranchIds.length) {
        return Boolean(resolved.countryBranchId && session.countryBranchIds.includes(resolved.countryBranchId));
      }
      if (session.countryIds.length) return Boolean(resolved.countryId && session.countryIds.includes(resolved.countryId));
      return false;
    }

    const rows: MessageRow[] = [];

    const includeCompany = (companyId: string | null) => {
      if (session.isSuperAdmin) return true;
      if (!defaultCompanyId) return true;
      return !companyId || companyId === defaultCompanyId;
    };

    const attachments = ((attachmentRes.data ?? []) as Array<{ id: string; company_id: string | null; owner_table: string; owner_id: string; bucket: string; path: string; created_at: string }>).filter((row) => includeCompany(row.company_id));
    const attachmentCountByOwner = new Map<string, number>();
    for (const attachment of attachments) {
      attachmentCountByOwner.set(attachment.owner_id, (attachmentCountByOwner.get(attachment.owner_id) ?? 0) + 1);
    }

    for (const email of emailMessages) {
      if (!canSeeScope(email.country_id, email.country_branch_id, email.city_branch_id)) continue;

      const cityBranch = email.city_branch_id ? cityBranchLookup.get(email.city_branch_id) ?? null : null;
      const countryBranch = email.country_branch_id
        ? countryBranchLookup.get(email.country_branch_id) ?? null
        : cityBranch?.country_branch_id
          ? countryBranchLookup.get(cityBranch.country_branch_id) ?? null
          : null;
      const countryId = email.country_id ?? cityBranch?.country_id ?? countryBranch?.country_id ?? null;
      const countryName = countryId ? countryLookup.get(countryId)?.name ?? "Country" : "Global";
      const branchId = email.city_branch_id ?? email.country_branch_id ?? countryId;
      const branchName = cityBranch
        ? `${cityBranch.city_name} - ${cityBranch.name}`
        : countryBranch
          ? countryBranch.name
          : countryName;
      const branchType = cityBranch ? "City Branch" : countryBranch ? "Main Branch" : countryId ? "Country" : "Global";

      rows.push({
        id: email.id,
        folder: email.folder,
        channel: email.channel,
        provider: email.delivery_status || "ERP Mail",
        subject: email.subject,
        preview: email.body.slice(0, 220),
        body: email.body,
        senderName: email.sender_name,
        senderEmail: email.sender_email,
        recipientSummary: email.recipient_to,
        ccSummary: email.recipient_cc,
        companyId: null,
        companyName: scopeLabel(countryId, countryName, branchType, branchName),
        branchId,
        branchName,
        branchType,
        createdAt: email.created_at,
        status: email.folder === "draft" ? "draft" : email.direction === "outgoing" ? "sent" : "received",
        isUnread: email.direction === "incoming",
        labels: normalizeStringArray(email.labels),
        attachmentCount: email.attachment_count ?? 0,
        linkedModule: email.linked_module,
        linkedRoute: email.linked_route,
        linkedDocumentNo: email.linked_document_no,
        sourceTable: "erp_email_messages",
        sourceId: email.id,
        action: `email.${email.direction}`,
        companyFilterKey: countryId ?? "global",
        branchFilterKey: branchIdKey(email.city_branch_id, email.country_branch_id, countryId)
      });
    }

    for (const row of auditRows) {
      if (!includeCompany(row.company_id)) continue;

      const after = (row.after ?? {}) as any;
      const before = (row.before ?? {}) as any;
      const folder = messageFolderFor(row.action, after);
      const companyId = (row.company_id ?? after?.companyId ?? after?.company_id ?? null) as string | null;
      const companyName = companyId ? companyLookup.get(companyId)?.name ?? "Company" : "Global";
      const countryId = (after?.countryId ?? after?.country_id ?? null) as string | null;
      const countryBranchId = (after?.countryBranchId ?? after?.country_branch_id ?? null) as string | null;
      const cityBranchId = (after?.cityBranchId ?? after?.city_branch_id ?? null) as string | null;
      const countryName = countryId ? countryLookup.get(countryId)?.name ?? null : null;
      const countryBranch = countryBranchId ? countryBranchLookup.get(countryBranchId) ?? null : null;
      const cityBranch = cityBranchId ? cityBranchLookup.get(cityBranchId) ?? null : null;
      if (!canSeeScope(countryId, countryBranchId, cityBranchId)) continue;
      const branchType = cityBranchId ? "City Branch" : countryBranchId ? "Main Branch" : countryId ? "Country" : "Global";
      const branchName = cityBranchId
        ? `${cityBranch?.city_name ?? cityBranch?.name ?? "City"} - ${cityBranch?.name ?? "Branch"}`
        : countryBranchId
          ? countryBranch?.name ?? "Main Branch"
          : countryId
            ? countryName ?? "Country"
            : "Global";
      const actor = row.actor_id ? actorLookup.get(row.actor_id) ?? null : null;
      const senderName =
        row.actor_id === session.userId
          ? profile?.full_name ?? profile?.user_code ?? session.fullName ?? session.email ?? "You"
          : actor?.full_name ?? (row.actor_id ? `User ${row.actor_id.slice(0, 8)}` : "ERP System");
      const recipients = normalizeStringArray(after?.to).concat(normalizeStringArray(after?.recipients));
      const cc = normalizeStringArray(after?.cc);
      const subject = deriveSubject(row.action, row.entity_table, after, before, row.entity_id);
      const preview = derivePreview(row.action, row.entity_table, after, before);
      const body = safeText(after?.body || after?.message || after?.description || after?.narration || after?.memo || preview);
      const linkedModule = deriveLinkedModule(row.entity_table, row.entity_table);
      const linkedRoute = after?.linkedRoute ? String(after.linkedRoute) : deriveLinkedRoute(row.entity_table, row.entity_table);
      const linkedDocumentNo = safeText(
        after?.documentNo || after?.document_no || after?.purchase_order_no || after?.entry_no || after?.transaction_no || after?.voucher_no || after?.journal_no || row.entity_id
      ) || null;
      const labels = uniqueStrings([
        ...(Array.isArray(after?.labels) ? after.labels.map((label: unknown) => (typeof label === "string" ? label : "")).filter(Boolean) : []),
        titleCase(row.entity_table),
        linkedModule,
        branchType !== "Global" ? branchType : null
      ]);

      rows.push({
        id: `audit:${row.id}`,
        folder,
        channel: query.channel,
        provider: safeText(after?.provider || "ERP Internal Messaging") || "ERP Internal Messaging",
        subject,
        preview,
        body,
        senderName,
        senderEmail: row.actor_id === session.userId ? session.email : null,
        recipientSummary: recipients.length ? recipients.join(", ") : (after?.recipientSummary ? String(after.recipientSummary) : "-"),
        ccSummary: cc.length ? cc.join(", ") : (after?.ccSummary ? String(after.ccSummary) : "-"),
        companyId,
        companyName,
        branchId: cityBranchId ?? countryBranchId ?? countryId,
        branchName,
        branchType,
        createdAt: row.created_at,
        status: messageStatus(folder, row.action),
        isUnread: folder === "inbox" || folder === "notifications",
        labels,
        attachmentCount: Array.isArray(after?.attachments) ? after.attachments.length : attachmentCountByOwner.get(row.id) ?? 0,
        linkedModule,
        linkedRoute,
        linkedDocumentNo,
        sourceTable: row.entity_table,
        sourceId: row.entity_id,
        action: row.action,
        companyFilterKey: companyId ?? "global",
        branchFilterKey: branchIdKey(cityBranchId, countryBranchId, countryId)
      });
    }

    const purchaseDrafts = ((purchaseDraftsRes.data ?? []) as DraftPurchaseOrderRow[]).filter((row) => includeCompany(row.supplier_company_id));
    for (const row of purchaseDrafts) {
      const companyId = row.supplier_company_id ?? null;
      const companyName = companyId ? companyLookup.get(companyId)?.name ?? "Supplier" : "Supplier";
      const countryId = row.country_id ?? null;
      const countryBranchId = row.country_branch_id ?? null;
      const cityBranchId = row.city_branch_id ?? null;
      const countryName = countryId ? countryLookup.get(countryId)?.name ?? null : null;
      const countryBranch = countryBranchId ? countryBranchLookup.get(countryBranchId) ?? null : null;
      const cityBranch = cityBranchId ? cityBranchLookup.get(cityBranchId) ?? null : null;
      if (!canSeeScope(countryId, countryBranchId, cityBranchId)) continue;
      rows.push({
        id: `purchase:${row.id}`,
        folder: "draft",
        channel: query.channel,
        provider: "ERP Internal Messaging",
        subject: `Draft Purchase Order ${row.purchase_order_no}`,
        preview: `Purchase total ${row.currency_code} ${String(row.order_total)} · ${row.payment_status ?? "draft"} · ${row.ledger_posting_status ?? "draft"}`,
        body: `Purchase Contract: ${row.purchase_contract_no ?? "-"}\nCurrency: ${row.currency_code}\nExchange Rate: ${row.exchange_rate}\nOrder Total: ${row.order_total}`,
        senderName: profile?.full_name ?? profile?.user_code ?? session.fullName ?? session.email ?? "You",
        senderEmail: session.email,
        recipientSummary: companyName,
        ccSummary: "-",
        companyId,
        companyName,
        branchId: cityBranchId ?? countryBranchId ?? countryId,
        branchName: cityBranchId
          ? `${cityBranch?.city_name ?? cityBranch?.name ?? "City"} - ${cityBranch?.name ?? "Branch"}`
          : countryBranchId
            ? countryBranch?.name ?? "Main Branch"
            : countryName ?? "Country",
        branchType: cityBranchId ? "City Branch" : countryBranchId ? "Main Branch" : countryId ? "Country" : "Global",
        createdAt: row.created_at,
        status: "draft",
        isUnread: false,
        labels: uniqueStrings(["Purchase Order", "Draft", row.payment_status ?? "Pending"]),
        attachmentCount: 0,
        linkedModule: "Purchase",
        linkedRoute: "/dashboard/purchase/purchase-order",
        linkedDocumentNo: row.purchase_order_no,
        sourceTable: "purchase_orders",
        sourceId: row.id,
        action: "purchase_order.draft",
        companyFilterKey: companyId ?? "global",
        branchFilterKey: branchIdKey(cityBranchId, countryBranchId, countryId)
      });
    }

    for (const row of ((journalDraftsRes.data ?? []) as DraftJournalEntryRow[])) {
      if (!includeCompany(row.company_id)) continue;
      if (!session.isSuperAdmin && row.branch_id) {
        if (session.cityBranchIds.length && !session.cityBranchIds.includes(row.branch_id)) continue;
        if (session.countryBranchIds.length && !session.countryBranchIds.includes(row.branch_id)) continue;
      }
      const companyId = row.company_id ?? null;
      const companyName = companyId ? companyLookup.get(companyId)?.name ?? "Company" : "Company";
      rows.push({
        id: `journal:${row.id}`,
        folder: "draft",
        channel: query.channel,
        provider: "ERP Internal Messaging",
        subject: `Draft Journal Entry ${row.entry_no}`,
        preview: row.memo ?? `Journal entry ${row.entry_no} is in draft status.`,
        body: row.memo ?? `Journal entry ${row.entry_no} is in draft status.`,
        senderName: profile?.full_name ?? profile?.user_code ?? session.fullName ?? session.email ?? "You",
        senderEmail: session.email,
        recipientSummary: companyName,
        ccSummary: "-",
        companyId,
        companyName,
        branchId: row.branch_id,
        branchName: row.branch_id ? "Branch" : "Global",
        branchType: row.branch_id ? "Branch" : "Global",
        createdAt: row.created_at,
        status: "draft",
        isUnread: false,
        labels: uniqueStrings(["Journal", "Draft"]),
        attachmentCount: 0,
        linkedModule: "Ledger",
        linkedRoute: "/dashboard/ledger/super-admin",
        linkedDocumentNo: row.entry_no,
        sourceTable: "journal_entries",
        sourceId: row.id,
        action: "journal_entries.draft",
        companyFilterKey: companyId ?? "global",
        branchFilterKey: branchIdKey(row.branch_id, null, null)
      });
    }

    for (const row of ((transactionDraftsRes.data ?? []) as DraftTransactionRow[])) {
      if (!includeCompany(null)) continue;
      const countryId = row.country_id ?? null;
      const cityBranchId = row.city_branch_id ?? null;
      if (!canSeeScope(countryId, null, cityBranchId)) continue;
      const countryName = countryId ? countryLookup.get(countryId)?.name ?? null : null;
      const cityBranch = cityBranchId ? cityBranchLookup.get(cityBranchId) ?? null : null;
      rows.push({
        id: `transaction:${row.id}`,
        folder: "draft",
        channel: query.channel,
        provider: "ERP Internal Messaging",
        subject: `Draft Payment ${row.transaction_no}`,
        preview: `${row.description ?? "Transaction"} · ${row.local_currency} ${String(row.local_amount)}`,
        body: row.description ?? `Draft payment ${row.transaction_no}`,
        senderName: profile?.full_name ?? profile?.user_code ?? session.fullName ?? session.email ?? "You",
        senderEmail: session.email,
        recipientSummary: countryName ?? "-",
        ccSummary: "-",
        companyId: defaultCompanyId,
        companyName: defaultCompanyId ? companyLookup.get(defaultCompanyId)?.name ?? "Company" : "Company",
        branchId: cityBranchId ?? countryId,
        branchName: cityBranchId ? `${cityBranch?.city_name ?? cityBranch?.name ?? "City"} - ${cityBranch?.name ?? "Branch"}` : countryName ?? "Country",
        branchType: cityBranchId ? "City Branch" : countryId ? "Country" : "Global",
        createdAt: row.created_at,
        status: "draft",
        isUnread: false,
        labels: uniqueStrings(["Payment", "Draft"]),
        attachmentCount: 0,
        linkedModule: "Payments",
        linkedRoute: "/dashboard/roznamcha/cash-entry",
        linkedDocumentNo: row.transaction_no,
        sourceTable: "transactions",
        sourceId: row.id,
        action: "transactions.draft",
        companyFilterKey: defaultCompanyId ?? "global",
        branchFilterKey: branchIdKey(cityBranchId, null, countryId)
      });
    }

    for (const row of ((roznamchaDraftsRes.data ?? []) as DraftRoznamchaRow[])) {
      if (!includeCompany(null)) continue;
      const countryId = row.country_id ?? null;
      const countryBranchId = row.country_branch_id ?? null;
      const cityBranchId = row.city_branch_id ?? null;
      if (!canSeeScope(countryId, countryBranchId, cityBranchId)) continue;
      const countryName = countryId ? countryLookup.get(countryId)?.name ?? null : null;
      const countryBranch = countryBranchId ? countryBranchLookup.get(countryBranchId) ?? null : null;
      const cityBranch = cityBranchId ? cityBranchLookup.get(cityBranchId) ?? null : null;
      rows.push({
        id: `roz:${row.id}`,
        folder: "draft",
        channel: query.channel,
        provider: "ERP Internal Messaging",
        subject: `Draft Roznamcha ${row.voucher_no ?? row.journal_no ?? row.id.slice(0, 8)}`,
        preview: row.narration ?? `Roznamcha ${row.type ?? ""} is in draft status.`,
        body: row.narration ?? `Roznamcha entry ${row.voucher_no ?? row.journal_no ?? row.id} is in draft status.`,
        senderName: profile?.full_name ?? profile?.user_code ?? session.fullName ?? session.email ?? "You",
        senderEmail: session.email,
        recipientSummary: countryName ?? "-",
        ccSummary: "-",
        companyId: defaultCompanyId,
        companyName: defaultCompanyId ? companyLookup.get(defaultCompanyId)?.name ?? "Company" : "Company",
        branchId: cityBranchId ?? countryBranchId ?? countryId,
        branchName: cityBranchId
          ? `${cityBranch?.city_name ?? cityBranch?.name ?? "City"} - ${cityBranch?.name ?? "Branch"}`
          : countryBranchId
            ? countryBranch?.name ?? "Main Branch"
            : countryName ?? "Country",
        branchType: cityBranchId ? "City Branch" : countryBranchId ? "Main Branch" : countryId ? "Country" : "Global",
        createdAt: row.created_at,
        status: "draft",
        isUnread: false,
        labels: uniqueStrings(["Roznamcha", "Draft"]),
        attachmentCount: 0,
        linkedModule: "Roznamcha",
        linkedRoute: "/dashboard/roznamcha/super-admin",
        linkedDocumentNo: row.voucher_no ?? row.journal_no,
        sourceTable: "roznamcha_entries",
        sourceId: row.id,
        action: "roznamcha_entries.draft",
        companyFilterKey: defaultCompanyId ?? "global",
        branchFilterKey: branchIdKey(cityBranchId, countryBranchId, countryId)
      });
    }

    const filtered = rows
      .filter((row) => row.channel === query.channel || query.channel === "email")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const summary = {
      totalMessages: filtered.length,
      inbox: filtered.filter((row) => row.folder === "inbox").length,
      sent: filtered.filter((row) => row.folder === "sent").length,
      drafts: filtered.filter((row) => row.folder === "draft").length,
      notifications: filtered.filter((row) => row.folder === "notifications").length,
      attachments: filtered.reduce((total, row) => total + row.attachmentCount, 0),
      providers: 4
    };

    const folders = [
      { key: "inbox", label: "Inbox", count: filtered.filter((row) => row.folder === "inbox").length },
      { key: "sent", label: "Sent", count: filtered.filter((row) => row.folder === "sent").length },
      { key: "draft", label: "Draft", count: filtered.filter((row) => row.folder === "draft").length },
      { key: "trash", label: "Trash", count: filtered.filter((row) => row.folder === "trash").length },
      { key: "spam", label: "Spam", count: filtered.filter((row) => row.folder === "spam").length },
      { key: "attachments", label: "Attachments", count: filtered.reduce((total, row) => total + row.attachmentCount, 0) },
      { key: "notifications", label: "ERP Notifications", count: filtered.filter((row) => row.folder === "notifications").length }
    ];

    const companies = uniqueOptions(filtered.map((row) => ({ value: row.companyId ?? "all", label: row.companyName, keywords: [row.companyName, row.senderName, row.recipientSummary].join(" ") }))).sort((a, b) => a.label.localeCompare(b.label));
    const branches = uniqueOptions(filtered.map((row) => ({ value: row.branchId ?? "all", label: row.branchName, keywords: [row.branchName, row.branchType, row.companyName].join(" ") }))).sort((a, b) => a.label.localeCompare(b.label));
    const providers = uniqueOptions(filtered.map((row) => ({ value: row.provider, label: row.provider, keywords: row.provider }))).sort((a, b) => a.label.localeCompare(b.label));
    const labels = uniqueOptions(
      filtered.flatMap((row) => row.labels.map((label) => ({ value: label, label, keywords: label })))
    ).sort((a, b) => a.label.localeCompare(b.label));

    const { data: accountsData } = await admin
      .from("erp_email_accounts")
      .select("id, email_address, is_active, scope, settings, country_id, country_branch_id, city_branch_id, provider:erp_email_providers(provider_name)")
      .is("deleted_at", null);

    const emailAccounts = accountsData || [];
    const branchEmailsDashboardList: any[] = [];
    const activeCityBranches = cityBranchesRes.data || [];
    
    for (const city of activeCityBranches) {
      const country = countryLookup.get(city.country_id);
      
      let matchedAccount = emailAccounts.find((a: any) => a.city_branch_id === city.id);
      
      if (!matchedAccount && city.country_branch_id) {
        matchedAccount = emailAccounts.find((a: any) => a.country_branch_id === city.country_branch_id);
      }
      if (!matchedAccount && city.country_id) {
        matchedAccount = emailAccounts.find((a: any) => a.country_id === city.country_id && a.scope === "country");
      }
      if (!matchedAccount) {
        matchedAccount = emailAccounts.find((a: any) => a.scope === "super_admin");
      }

      let smtpStatus = "🔴 SMTP Failed";
      let emailStatus = "❌ Not Ready";
      let officialEmail = "—";

      if (matchedAccount) {
        officialEmail = matchedAccount.email_address;
        const settings = matchedAccount.settings || {};
        const hasPassword = Boolean(settings.smtpPass || settings.password || settings.appPassword);
        const hasHost = Boolean(settings.smtpHost || settings.host);
        
        if (hasPassword && hasHost) {
          smtpStatus = matchedAccount.is_active ? "Connected" : "🔴 SMTP Failed";
          emailStatus = matchedAccount.is_active ? "✅ Ready" : "❌ Not Ready";
        } else {
          smtpStatus = "🟡 Configuration Incomplete";
          emailStatus = "❌ Not Ready";
        }
      } else if (country?.official_email) {
        officialEmail = country.official_email;
        smtpStatus = "🟡 Configuration Incomplete";
        emailStatus = "❌ Not Ready";
      } else {
        smtpStatus = "⚪ No Email Configured";
        emailStatus = "❌ Not Ready";
      }

      branchEmailsDashboardList.push({
        country: country?.name || "Pakistan",
        branch: city.name || "Chaman Branch",
        officialEmail,
        smtpStatus,
        emailStatus,
        branchId: city.id,
        countryId: city.country_id
      });
    }

    return apiOk({
      channel: query.channel,
      summary,
      folders,
      filters: { companies, branches, providers, labels },
      rows: filtered,
      branchEmailsDashboardList,
      countries: countriesRes.data || [],
      cityBranches: cityBranchesRes.data || [],
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = composeSchema.parse(await request.json());

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validateEmails = (emailStr: string | undefined) => {
      if (!emailStr) return true;
      const parts = emailStr.split(",").map((e) => {
        const match = e.match(/<([^>]+)>/);
        return match ? match[1].trim() : e.trim();
      }).filter(Boolean);
      return parts.length > 0 && parts.every((email) => emailRegex.test(email));
    };

    if (body.channel === "email" && body.folder === "sent") {
      if (!body.to || !validateEmails(body.to)) {
        return Response.json({ success: false, error: "Recipient 'To' email address is invalid (e.g. name@domain.com)." }, { status: 400 });
      }
      if (body.cc && !validateEmails(body.cc)) {
        return Response.json({ success: false, error: "Recipient 'CC' email address is invalid." }, { status: 400 });
      }
      if (body.bcc && !validateEmails(body.bcc)) {
        return Response.json({ success: false, error: "Recipient 'BCC' email address is invalid." }, { status: 400 });
      }
    }

    const admin = createSupabaseAdminClient() as any;

    const profileRes = await admin.from("profiles").select("id, full_name, user_code, default_company_id").eq("id", session.userId).maybeSingle();
    if (profileRes.error) throw new Error(profileRes.error.message);
    const profile = profileRes.data as ProfileRow | null;

    // AI-Powered Document-Based Auto-Detection Layer
    let detectedCountryId: string | null = body.countryId ?? null;
    let detectedCountryBranchId: string | null = body.countryBranchId ?? null;
    let detectedCityBranchId: string | null = body.cityBranchId ?? null;
    let detectedCompanyId: string | null = body.companyId ?? null;

    if ((!detectedCityBranchId && !detectedCountryBranchId && !detectedCountryId) && body.linkedModule) {
      const module = body.linkedModule.toLowerCase();
      const docNo = body.linkedDocumentNo;

      if ((module === "purchase_order" || module === "purchase order" || module === "purchase") && docNo) {
        const queryBuilder = admin.from("purchase_orders").select("country_id, country_branch_id, city_branch_id, supplier_company_id");
        const poQuery = docNo.match(/^[0-9a-fA-F-]{36}$/)
          ? queryBuilder.eq("id", docNo)
          : queryBuilder.eq("purchase_order_no", docNo);
        const { data: po } = await poQuery.maybeSingle();
        if (po) {
          detectedCountryId = po.country_id;
          detectedCountryBranchId = po.country_branch_id;
          detectedCityBranchId = po.city_branch_id;
          detectedCompanyId = po.supplier_company_id;
        }
      } else if (module.includes("customer") && docNo) {
        const queryBuilder = admin.from("customers").select("country_id");
        const custQuery = docNo.match(/^[0-9a-fA-F-]{36}$/)
          ? queryBuilder.eq("id", docNo)
          : queryBuilder.eq("customer_name", docNo);
        const { data: cust } = await custQuery.maybeSingle();
        if (cust) {
          detectedCountryId = cust.country_id;
        }
      } else if (module.includes("supplier") && docNo) {
        const queryBuilder = admin.from("companies").select("country_id");
        const suppQuery = docNo.match(/^[0-9a-fA-F-]{36}$/)
          ? queryBuilder.eq("id", docNo)
          : queryBuilder.eq("name", docNo);
        const { data: comp } = await suppQuery.maybeSingle();
        if (comp) {
          detectedCountryId = comp.country_id;
        }
      } else if (docNo) {
        // Look up standard erp_documents by id or entity_id
        const { data: doc } = await admin
          .from("erp_documents")
          .select("country_id, city_branch_id, company_id")
          .or(`id.eq.${docNo},entity_id.eq.${docNo}`)
          .maybeSingle();
        if (doc) {
          detectedCountryId = doc.country_id;
          detectedCityBranchId = doc.city_branch_id;
          detectedCompanyId = doc.company_id;
        }
      }
    }

    const scope = {
      countryId: detectedCountryId ?? firstScope(session.countryIds),
      countryBranchId: detectedCountryBranchId ?? firstScope(session.countryBranchIds),
      cityBranchId: detectedCityBranchId ?? firstScope(session.cityBranchIds)
    };

    if (!session.isSuperAdmin) {
      if (session.cityBranchIds.length && (!scope.cityBranchId || !session.cityBranchIds.includes(scope.cityBranchId))) {
        throw new Error("You can only send emails from your assigned branch.");
      }
      if (!session.cityBranchIds.length && session.countryBranchIds.length && (!scope.countryBranchId || !session.countryBranchIds.includes(scope.countryBranchId))) {
        throw new Error("You can only send emails from your assigned main branch.");
      }
      if (!session.cityBranchIds.length && !session.countryBranchIds.length && session.countryIds.length && (!scope.countryId || !session.countryIds.includes(scope.countryId))) {
        throw new Error("You can only send emails from your assigned country.");
      }
    }

    const [countryRes, countryBranchRes, cityBranchRes] = await Promise.all([
      scope.countryId ? admin.from("countries").select("id, name, iso2, official_email, admin_email, email_domain, email_server_settings").eq("id", scope.countryId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      scope.countryBranchId ? admin.from("country_branches").select("id, name, code, country_id, email").eq("id", scope.countryBranchId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      scope.cityBranchId ? admin.from("city_branches").select("id, name, code, city_name, country_id, country_branch_id, email").eq("id", scope.cityBranchId).maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);
    if ((countryRes as any).error) throw new Error((countryRes as any).error.message);
    if ((countryBranchRes as any).error) throw new Error((countryBranchRes as any).error.message);
    if ((cityBranchRes as any).error) throw new Error((cityBranchRes as any).error.message);

    let country = (countryRes as any).data as CountryRow | null;
    let countryBranch = (countryBranchRes as any).data as CountryBranchRow | null;
    const cityBranch = (cityBranchRes as any).data as CityBranchRow | null;

    if (!countryBranch && cityBranch?.country_branch_id) {
      const inferredCountryBranch = await admin.from("country_branches").select("id, name, code, country_id, email").eq("id", cityBranch.country_branch_id).maybeSingle();
      if (inferredCountryBranch.error) throw new Error(inferredCountryBranch.error.message);
      countryBranch = inferredCountryBranch.data as CountryBranchRow | null;
      scope.countryBranchId = countryBranch?.id ?? scope.countryBranchId;
    }

    const resolvedCountryId = scope.countryId ?? cityBranch?.country_id ?? countryBranch?.country_id ?? null;
    if (!country && resolvedCountryId) {
      const inferredCountry = await admin.from("countries").select("id, name, iso2, official_email, admin_email, email_domain, email_server_settings").eq("id", resolvedCountryId).maybeSingle();
      if (inferredCountry.error) throw new Error(inferredCountry.error.message);
      country = inferredCountry.data as CountryRow | null;
      scope.countryId = country?.id ?? resolvedCountryId;
    }

    const emailConfig = resolveCountryEmailConfig(country, {
      mainBranchName: countryBranch?.name ?? null,
      mainBranchCode: countryBranch?.code ?? null,
      cityBranchName: cityBranch?.name ?? null,
      cityBranchCode: cityBranch?.code ?? null,
      cityName: cityBranch?.city_name ?? null
    });
    const senderBranchName = emailConfig.displayBranchName;
    const senderName = emailConfig.fromName;
    const ccParts = uniqueStrings([
      body.cc ?? null,
      emailConfig.adminEmail,
      "Super Admin"
    ]);
    const scopedSenderEmail = emailConfig.fromEmail ?? session.email ?? null;
    const signedBody = appendCountryEmailSignature(body.body, emailConfig);

    const payload = {
      channel: body.channel,
      folder: body.folder,
      provider: body.provider ?? "ERP Internal Messaging",
      to: body.to ?? "",
      cc: ccParts.join(", "),
      subject: body.subject,
      body: signedBody,
      companyId: body.companyId ?? profile?.default_company_id ?? null,
      countryId: scope.countryId,
      countryBranchId: scope.countryBranchId,
      cityBranchId: scope.cityBranchId,
      linkedRoute: body.linkedRoute ?? null,
      linkedModule: body.linkedModule ?? null,
      labels: body.labels ?? [],
      senderUserId: session.userId,
      senderName,
      senderEmail: scopedSenderEmail,
      senderOfficeName: emailConfig.officeName,
      senderBranchName,
      senderMainBranchName: emailConfig.mainBranchName,
      senderSubBranchName: emailConfig.subBranchName,
      senderBranchCode: cityBranch?.code ?? countryBranch?.code ?? null,
      senderCountryName: emailConfig.countryName,
      emailSignature: emailConfig.signatureText,
      createdAt: new Date().toISOString()
    };

    const action = body.folder === "draft" ? "message.draft.save" : "message.send";
    const inserted = await admin
      .from("audit_logs")
      .insert({
        company_id: payload.companyId,
        actor_id: session.userId,
        action,
        entity_table: "erp_messages",
        entity_id: null,
        before: null,
        after: payload,
        ip_address: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
      })
      .select("id")
      .single();

    if (inserted.error) throw new Error(inserted.error.message);    try {
      const provider = await admin
        .from("erp_email_providers")
        .select("id")
        .eq("domain", emailConfig.emailDomain ?? "dgt.llc")
        .is("deleted_at", null)
        .maybeSingle();
      const fallbackProvider =
        provider.data?.id
          ? provider
          : await admin.from("erp_email_providers").select("id").is("deleted_at", null).order("created_at", { ascending: true }).limit(1).maybeSingle();

      const accountRes = scopedSenderEmail
        ? await admin
            .from("erp_email_accounts")
            .select("id, settings")
            .eq("email_address", scopedSenderEmail)
            .is("deleted_at", null)
            .maybeSingle()
        : { data: null, error: null };

      const accountSettings = (accountRes.data?.settings ?? {}) as Record<string, any>;
      const countrySettings = (country?.email_server_settings ?? {}) as Record<string, any>;

      const smtpConfig = {
        host: accountSettings.smtpHost ?? countrySettings.smtpHost ?? process.env.SMTP_HOST ?? "smtp.gmail.com",
        port: Number(accountSettings.smtpPort ?? countrySettings.smtpPort ?? process.env.SMTP_PORT ?? 465),
        secure: Boolean(accountSettings.smtpSecure !== undefined ? accountSettings.smtpSecure : (countrySettings.smtpSecure !== undefined ? countrySettings.smtpSecure : true)),
        auth: {
          user: accountSettings.smtpUser ?? countrySettings.smtpUser ?? process.env.SMTP_USER ?? scopedSenderEmail ?? "",
          pass: decrypt(accountSettings.smtpPass ?? countrySettings.smtpPass ?? process.env.SMTP_PASS ?? "")
        }
      };

      let deliveryStatus = "logged";
      let errorMessage = null;
      let errorCode = null;

      if (body.folder === "sent") {
        const missingFields: string[] = [];
        if (!scope.countryId) missingFields.push("Country ID");
        if (!body.companyId && !profile?.default_company_id) missingFields.push("Company ID");
        if (!scope.cityBranchId && !scope.countryBranchId && !scope.countryId) missingFields.push("Branch ID");
        if (!accountRes.data?.id) missingFields.push("Email Account ID");
        if (!scopedSenderEmail) missingFields.push("From Email");
        if (!smtpConfig.host) missingFields.push("SMTP Host");
        if (!smtpConfig.port) missingFields.push("SMTP Port");
        if (!smtpConfig.auth.user) missingFields.push("SMTP Username");
        if (!smtpConfig.auth.pass) missingFields.push("SMTP Password/App Password");

        if (missingFields.length > 0) {
          throw new Error(`Email sending aborted. Missing required configurations: ${missingFields.join(", ")}`);
        }

        try {
          await sendEmailDirect(smtpConfig, {
            from: `"${senderName}" <${scopedSenderEmail}>`,
            to: body.to ?? "",
            cc: ccParts.filter(Boolean),
            bcc: body.bcc ?? "",
            subject: body.subject,
            html: signedBody,
            attachments: body.attachments?.map((att: any) => ({
              filename: att.filename,
              content: att.content,
              contentType: att.contentType
            }))
          });
          deliveryStatus = "sent";
        } catch (err: any) {
          deliveryStatus = "failed";
          errorMessage = err.message || "Failed to send email via SMTP";
          errorCode = err.code || "SMTP_SEND_FAILED";
        }
      } else {
        deliveryStatus = "draft";
      }

      const emailInsert = await admin.from("erp_email_messages").insert({
        channel: body.channel,
        folder: body.folder,
        provider_id: fallbackProvider.data?.id ?? null,
        email_account_id: accountRes.data?.id ?? null,
        country_id: scope.countryId,
        country_branch_id: scope.countryBranchId,
        city_branch_id: scope.cityBranchId,
        customer_id: null,
        sender_user_id: session.userId,
        sender_name: senderName,
        sender_email: scopedSenderEmail,
        recipient_to: body.to ?? "",
        recipient_cc: ccParts.join(", "),
        recipient_bcc: body.bcc ?? "",
        subject: body.subject,
        body: signedBody,
        labels: body.labels ?? [],
        attachment_count: body.attachments?.length ?? 0,
        attachments: body.attachments ?? [],
        delivery_status: deliveryStatus,
        direction: body.folder === "draft" ? "internal" : "outgoing",
        linked_module: body.linkedModule ?? null,
        linked_route: body.linkedRoute ?? null,
        linked_document_no: body.linkedDocumentNo ?? null,
        audit_payload: {
          auditLogId: inserted.data.id,
          senderOfficeName: emailConfig.officeName,
          senderBranchName,
          senderMainBranchName: emailConfig.mainBranchName,
          senderSubBranchName: emailConfig.subBranchName,
          senderBranchCode: cityBranch?.code ?? countryBranch?.code ?? null,
          senderCountryName: emailConfig.countryName,
          fromEmail: scopedSenderEmail,
          replyTo: emailConfig.replyTo,
          emailSignature: emailConfig.signatureText,
          ccPolicy: { ccCountryAdmin: Boolean(emailConfig.adminEmail), ccSuperAdmin: true },
          countryEmailConfig: emailConfig,
          errorMessage: errorMessage,
          errorCode: errorCode,
          failedTime: deliveryStatus === "failed" ? new Date().toISOString() : null
        },
        sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null
      });
      if (emailInsert.error) throw new Error(emailInsert.error.message);

      if (deliveryStatus === "failed") {
        throw new Error(`SMTP Error [${errorCode}]: ${errorMessage}`);
      }
    } catch (err: any) {
      throw err;
    }

    return apiCreated({ id: inserted.data.id as string });
  } catch (error) {
    return handleApiError(error);
  }
}

function branchIdKey(cityBranchId: string | null, countryBranchId: string | null, countryId: string | null) {
  return cityBranchId ?? countryBranchId ?? countryId ?? "global";
}

function uniqueOptions(options: Array<{ value: string; label: string; keywords: string }>) {
  const map = new Map<string, { value: string; label: string; keywords: string }>();
  for (const option of options) {
    if (!map.has(option.value)) map.set(option.value, option);
  }
  return [...map.values()].filter((option) => option.value !== "all");
}



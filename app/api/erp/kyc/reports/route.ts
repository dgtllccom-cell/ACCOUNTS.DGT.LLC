import { NextResponse } from "next/server";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";

type KycEntityType = "country_branch" | "city_branch" | "user_account" | "new_account";

export type KycReportItem = {
  id: string;
  name: string;
  code?: string | null;
  type: KycEntityType;
  typeLabel: string;
  countryName: string;
  cityName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "incomplete" | "near_expiry" | "suspended" | "compliant";
  statusBadge: string;
  missingRequirements: string[];
  createdAt: string;
  graceTotalDays: number;
  daysRemaining: number;
  progressPercent: number;
  ownerName?: string | null;
  documentsCount: number;
  editUrl?: string;
  rawDetails: Record<string, any>;
};

function calculateGraceStatus(createdAt: string, missingReqs: string[]) {
  const GRACE_PERIOD_DAYS = 15;
  const createdDate = new Date(createdAt || Date.now());
  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysElapsed);
  const progressPercent = Math.min(100, Math.round((daysElapsed / GRACE_PERIOD_DAYS) * 100));

  if (missingReqs.length === 0) {
    return {
      status: "compliant" as const,
      daysRemaining,
      progressPercent: 100,
      statusBadge: "Verified & Compliant"
    };
  }

  if (daysRemaining === 0) {
    return {
      status: "suspended" as const,
      daysRemaining: 0,
      progressPercent: 100,
      statusBadge: "Suspended (Grace Period Overdue)"
    };
  }

  if (daysRemaining <= 5) {
    return {
      status: "near_expiry" as const,
      daysRemaining,
      progressPercent,
      statusBadge: `Near Expiry (${daysRemaining} Days Left)`
    };
  }

  return {
    status: "incomplete" as const,
    daysRemaining,
    progressPercent,
    statusBadge: `Incomplete (${daysRemaining} Days Left)`
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const supabase = createSupabaseAdminClient() as any;

    const [
      countriesRes,
      countryBranchesRes,
      cityBranchesRes,
      usersRes,
      enterpriseAccountsRes,
      companiesRes,
      customersRes
    ] = await Promise.all([
      supabase.from("countries").select("id, name, iso2, currency_code, official_email, admin_email, created_at").is("deleted_at", null),
      supabase.from("country_branches").select("id, country_id, name, code, is_main, address, phone, email, whatsapp_number, owner_name, documents, contacts, created_at").is("deleted_at", null),
      supabase.from("city_branches").select("id, country_id, country_branch_id, name, code, address, phone, email, contacts, documents, created_at").is("deleted_at", null),
      supabase.from("profiles").select("id, full_name, preferred_language_code, created_at").limit(50),
      supabase.from("enterprise_accounts").select("id, code, name, country_id, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
      supabase.from("companies").select("id, company_name, registration_number, phone, email, address, created_at").is("deleted_at", null).limit(50),
      supabase.from("customers").select("id, customer_name, phone, email, address, created_at").is("deleted_at", null).limit(50)
    ]);

    const countriesMap = new Map<string, string>();
    (countriesRes.data ?? []).forEach((c: any) => {
      countriesMap.set(c.id, c.name);
    });

    const items: KycReportItem[] = [];

    // 1. Process Country Branches (e.g. Pakistan Country Branch)
    (countryBranchesRes.data ?? []).forEach((cb: any) => {
      const missing: string[] = [];
      if (!cb.owner_name) missing.push("Missing Registered Owner Name");
      if (!cb.phone && !cb.whatsapp_number) missing.push("Missing Contact Phone / WhatsApp");
      if (!cb.address) missing.push("Missing Official Physical Address");
      if (!Array.isArray(cb.documents) || cb.documents.length === 0) missing.push("Missing NTN / Trade License Documents");
      if (!cb.email) missing.push("Missing Official Email Account");

      const countryName = countriesMap.get(cb.country_id) || "Global";
      const grace = calculateGraceStatus(cb.created_at, missing);

      items.push({
        id: cb.id,
        name: `${countryName} - ${cb.name || "Main Branch"}`,
        code: cb.code || "CB-MAIN",
        type: "country_branch",
        typeLabel: "Country Main Branch",
        countryName,
        email: cb.email,
        phone: cb.phone || cb.whatsapp_number,
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: cb.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        ownerName: cb.owner_name,
        documentsCount: Array.isArray(cb.documents) ? cb.documents.length : 0,
        editUrl: `/dashboard/new-entry/branch-entry/country-branch?id=${cb.id}`,
        rawDetails: cb
      });
    });

    // 2. Process City Branches (e.g. Lahore / Karachi Branches)
    (cityBranchesRes.data ?? []).forEach((cbr: any) => {
      const missing: string[] = [];
      if (!cbr.phone) missing.push("Missing Branch Telephone");
      if (!cbr.address) missing.push("Missing City Branch Physical Address");
      if (!Array.isArray(cbr.documents) || cbr.documents.length === 0) missing.push("Missing Municipal Trade License / Registration Certificate");
      if (!cbr.email) missing.push("Missing Branch Email");

      const countryName = countriesMap.get(cbr.country_id) || "Branch Node";
      const grace = calculateGraceStatus(cbr.created_at, missing);

      items.push({
        id: cbr.id,
        name: cbr.name || "City Branch",
        code: cbr.code || "CITY-BR",
        type: "city_branch",
        typeLabel: "City Branch Node",
        countryName,
        cityName: cbr.name,
        email: cbr.email,
        phone: cbr.phone,
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: cbr.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        documentsCount: Array.isArray(cbr.documents) ? cbr.documents.length : 0,
        editUrl: `/dashboard/new-entry/branch-entry/city-branch?id=${cbr.id}`,
        rawDetails: cbr
      });
    });

    // 3. Process User Accounts (Staff / Employees)
    (usersRes.data ?? []).forEach((u: any) => {
      const missing: string[] = [];
      if (!u.full_name) missing.push("Missing Official Full Name Verification");
      missing.push("Missing Identity CNIC / Passport Copy");

      const grace = calculateGraceStatus(u.created_at, missing);

      items.push({
        id: u.id,
        name: u.full_name || "User Account",
        code: `USR-${u.id.substring(0, 6).toUpperCase()}`,
        type: "user_account",
        typeLabel: "Employee / User Account",
        countryName: "System Registered",
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: u.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        documentsCount: 0,
        editUrl: `/dashboard/new-entry/users/registration?id=${u.id}`,
        rawDetails: u
      });
    });

    // 4. Process Commercial / New Enterprise Accounts (including newly created ones)
    (enterpriseAccountsRes.data ?? []).forEach((acc: any) => {
      const missing: string[] = [];
      if (!acc.name) missing.push("Missing Account Title");
      missing.push("Missing Commercial Tax / NTN Registration");
      missing.push("Missing Owner ID Proof");

      const countryName = countriesMap.get(acc.country_id) || "General Ledger";
      const grace = calculateGraceStatus(acc.created_at, missing);

      items.push({
        id: acc.id,
        name: acc.name || `Account ${acc.code}`,
        code: acc.code || "ACC-NEW",
        type: "new_account",
        typeLabel: "New Ledger Account",
        countryName,
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: acc.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        documentsCount: 0,
        editUrl: `/dashboard/accounts/setup?id=${acc.id}`,
        rawDetails: acc
      });
    });

    // Metrics summary
    const metrics = {
      total: items.length,
      incomplete: items.filter((i) => i.status === "incomplete").length,
      nearExpiry: items.filter((i) => i.status === "near_expiry").length,
      suspended: items.filter((i) => i.status === "suspended").length,
      compliant: items.filter((i) => i.status === "compliant").length
    };

    return NextResponse.json({ items, metrics }, { status: 200 });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load KYC reports.";
    return NextResponse.json({ error: message, items: [], metrics: { total: 0, incomplete: 0, nearExpiry: 0, suspended: 0, compliant: 0 } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const { entityId, entityType, action, ownerName, phone, email, address, documents } = body;

    if (!entityId || !entityType) {
      return NextResponse.json({ error: "Missing entityId or entityType" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient() as any;

    if (entityType === "country_branch") {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (ownerName) updateData.owner_name = ownerName.trim();
      if (phone) updateData.phone = phone.trim();
      if (email) updateData.email = email.trim().toLowerCase();
      if (address) updateData.address = address.trim();
      if (Array.isArray(documents)) updateData.documents = documents;

      await supabase.from("country_branches").update(updateData).eq("id", entityId);
    } else if (entityType === "city_branch") {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (phone) updateData.phone = phone.trim();
      if (email) updateData.email = email.trim().toLowerCase();
      if (address) updateData.address = address.trim();
      if (Array.isArray(documents)) updateData.documents = documents;

      await supabase.from("city_branches").update(updateData).eq("id", entityId);
    } else if (entityType === "user_account") {
      if (ownerName) {
        await supabase.from("profiles").update({ full_name: ownerName.trim() }).eq("id", entityId);
      }
    }

    await auditApiAction(request as any, {
      action: "kyc.update.api",
      entityTable: entityType,
      entityId,
      after: { action, ownerName, phone, email, address, documentsCount: documents?.length ?? 0 }
    });

    return NextResponse.json({ ok: true, message: "KYC records updated successfully!" }, { status: 200 });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to update KYC record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

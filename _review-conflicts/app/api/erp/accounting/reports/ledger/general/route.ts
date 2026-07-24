import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ledgerReportService } from "@/lib/services/ledger-report-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";

const querySchema = z.object({
  reportScope: z.enum(["super_admin", "country", "branch"]).default("super_admin"),
  q: z.string().trim().max(200).optional(),
  scope: z.string().trim().max(50).optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  ledgerId: z.string().min(1).optional(),
  fromDate: z.string().trim().min(8).optional(),
  toDate: z.string().trim().min(8).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(250)
});

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const language = await getRequestLanguage();
    const query = querySchema.parse({
      reportScope: request.nextUrl.searchParams.get("reportScope") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      scope: request.nextUrl.searchParams.get("scope") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      ledgerId: request.nextUrl.searchParams.get("ledgerId") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const fromDate = query.fromDate ?? monthStartIso();
    const toDate = query.toDate ?? todayIso();
    const admin = createSupabaseAdminClient() as any;

    const ledgerIdsParam = query.ledgerId ? query.ledgerId.split(",") : null;

    const rawLedgers = await ledgerReportService.listLedgers({
      session,
      reportScope: query.reportScope,
      ledgerId: ledgerIdsParam,
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
      limit: query.limit,
      language
    });

    let rows = query.scope ? rawLedgers.filter((row) => row.scope === query.scope) : rawLedgers;
    const qText = normalizeForSearch(query.q ?? "");
    if (qText) {
      rows = rows.filter((row) => {
        const hay = normalizeForSearch(
          [
            row.ledgerCode,
            row.ledgerName,
            row.accountCode,
            row.rawAccountCode,
            row.manualReferenceNumber,
            row.customerNumber,
            row.countrySerialNumber,
            row.branchSerialNumber,
            row.accountName,
            row.accountKind,
            row.companyName,
            row.countryName,
            row.stateName,
            row.cityName,
            row.countryBranchName,
            row.cityBranchName,
            row.address,
            row.ledgerCurrency
          ]
            .filter(Boolean)
            .join(" ")
        );
        return hay.includes(qText);
      });
    }

    const ledgerIds = rows.map((row) => row.ledgerId);
    const balanceMap = new Map<
      string,
      { debit: number; credit: number; balance: number; updatedAt: string; balanceDate: string }
    >();

    if (ledgerIds.length) {
      const { data: balanceRows, error: balanceError } = await admin
        .from("ledger_balances")
        .select("ledger_id, balance_date, debit_total, credit_total, closing_balance, updated_at")
        .in("ledger_id", ledgerIds)
        .order("balance_date", { ascending: false });
      if (balanceError) throw new Error(balanceError.message);

      for (const row of balanceRows ?? []) {
        const ledgerId = (row as any).ledger_id as string;
        if (balanceMap.has(ledgerId)) continue;
        balanceMap.set(ledgerId, {
          debit: toNumber((row as any).debit_total),
          credit: toNumber((row as any).credit_total),
          balance: toNumber((row as any).closing_balance),
          updatedAt: String((row as any).updated_at ?? ""),
          balanceDate: String((row as any).balance_date ?? "")
        });
      }
    }

    const [batchLinesRes, rozLinesRes] = ledgerIds.length
      ? await Promise.all([
          admin
            .from("ledger_posting_lines")
            .select(
              "ledger_id, description, debit, credit, currency, usd_rate, usd_amount, created_at, ledger_posting_batches!inner(entry_date, reference_no, created_by, created_at)"
            )
            .in("ledger_id", ledgerIds)
            .gte("ledger_posting_batches.entry_date", fromDate)
            .lte("ledger_posting_batches.entry_date", toDate)
            .order("created_at", { ascending: true }),
          admin
            .from("roznamcha_lines")
            .select(
              "ledger_id, description, debit, credit, currency, usd_rate, usd_amount, roznamcha_entries!inner(entry_date, voucher_no, created_by, created_at)"
            )
            .in("ledger_id", ledgerIds)
            .gte("roznamcha_entries.entry_date", fromDate)
            .lte("roznamcha_entries.entry_date", toDate)
            .order("entry_date", { ascending: true, foreignTable: "roznamcha_entries" })
            .order("created_at", { ascending: true, foreignTable: "roznamcha_entries" })
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if ((batchLinesRes as any).error) throw new Error((batchLinesRes as any).error.message);
    if ((rozLinesRes as any).error) throw new Error((rozLinesRes as any).error.message);

    type AggRow = {
      entries: number;
      debit: number;
      credit: number;
      usdDebit: number;
      usdCredit: number;
      lastActivityAt: string | null;
      lastReferenceNo: string | null;
      lastSource: "ledger" | "roznamcha" | null;
      lastDescription: string | null;
      lastEntryDate: string | null;
    };

    const agg = new Map<string, AggRow>();
    function ensure(id: string): AggRow {
      if (!agg.has(id)) {
        agg.set(id, {
          entries: 0,
          debit: 0,
          credit: 0,
          usdDebit: 0,
          usdCredit: 0,
          lastActivityAt: null,
          lastReferenceNo: null,
          lastSource: null,
          lastDescription: null,
          lastEntryDate: null
        });
      }
      return agg.get(id)!;
    }

    function calcUsd(localValue: number, usdRate: unknown, usdAmount: unknown) {
      if (!localValue) return 0;
      const amt = toNumber(usdAmount);
      if (amt > 0) return amt;
      const rate = toNumber(usdRate);
      if (rate > 0) return localValue * rate;
      return 0;
    }

    for (const row of (batchLinesRes as any).data ?? []) {
      const ledgerId = String(row.ledger_id);
      const entry = ensure(ledgerId);
      entry.entries += 1;
      const deb = toNumber(row.debit);
      const cre = toNumber(row.credit);
      entry.debit += deb;
      entry.credit += cre;
      if (deb > 0) entry.usdDebit += calcUsd(deb, row.usd_rate, row.usd_amount);
      if (cre > 0) entry.usdCredit += calcUsd(cre, row.usd_rate, row.usd_amount);

      const header = row.ledger_posting_batches ?? {};
      const activityAt = String(header.created_at ?? row.created_at ?? header.entry_date ?? "");
      if (!entry.lastActivityAt || activityAt > entry.lastActivityAt) {
        entry.lastActivityAt = activityAt;
        entry.lastReferenceNo = header.reference_no ?? null;
        entry.lastSource = "ledger";
        entry.lastDescription = row.description ?? null;
        entry.lastEntryDate = header.entry_date ?? null;
      }
    }

    for (const row of (rozLinesRes as any).data ?? []) {
      const ledgerId = String(row.ledger_id);
      const entry = ensure(ledgerId);
      entry.entries += 1;
      const deb = toNumber(row.debit);
      const cre = toNumber(row.credit);
      entry.debit += deb;
      entry.credit += cre;
      if (deb > 0) entry.usdDebit += calcUsd(deb, row.usd_rate, row.usd_amount);
      if (cre > 0) entry.usdCredit += calcUsd(cre, row.usd_rate, row.usd_amount);

      const header = row.roznamcha_entries ?? {};
      const activityAt = String(header.created_at ?? row.created_at ?? header.entry_date ?? "");
      if (!entry.lastActivityAt || activityAt > entry.lastActivityAt) {
        entry.lastActivityAt = activityAt;
        entry.lastReferenceNo = header.voucher_no ?? null;
        entry.lastSource = "roznamcha";
        entry.lastDescription = row.description ?? null;
        entry.lastEntryDate = header.entry_date ?? null;
      }
    }

    const rowsWithTotals = rows.map((row) => {
      const totals = agg.get(row.ledgerId) ?? { entries: 0, debit: 0, credit: 0, usdDebit: 0, usdCredit: 0, lastActivityAt: null, lastReferenceNo: null, lastSource: null, lastDescription: null, lastEntryDate: null };
      const balance = balanceMap.get(row.ledgerId);
      const branch = row.cityBranchName || row.countryBranchName || row.countryName || "-";
      
      const currentBal = balance?.balance ?? (row.normalBalance === "credit" ? totals.credit - totals.debit : totals.debit - totals.credit);
      let opBal = currentBal;
      if (row.normalBalance === "credit") {
         opBal = currentBal - totals.credit + totals.debit;
      } else {
         opBal = currentBal - totals.debit + totals.credit;
      }

      // For USD balance, we compute it purely from period totals since we don't store USD in ledger_balances
      const usdBalance = row.normalBalance === "credit" ? totals.usdCredit - totals.usdDebit : totals.usdDebit - totals.usdCredit;

      return {
        ...row,
        branch,
        status: row.isActive ? "active" : "inactive",
        entries: totals.entries,
        debit: totals.debit,
        credit: totals.credit,
        balance: currentBal,
        openingBalance: opBal,
        usdDebit: totals.usdDebit,
        usdCredit: totals.usdCredit,
        usdBalance,
        balanceDate: balance?.balanceDate ?? null,
        lastActivityAt: totals.lastActivityAt,
        lastReferenceNo: totals.lastReferenceNo,
        lastSource: totals.lastSource,
        lastDescription: totals.lastDescription,
        lastEntryDate: totals.lastEntryDate
      };
    });

    const groupedMap = new Map<string, typeof rowsWithTotals[0] & { ledgerIds: string[] }>();
    
    for (const r of rowsWithTotals) {
      const key = r.rawAccountCode || r.accountCode || r.ledgerCode || r.ledgerId;
      
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { ...r, ledgerIds: [r.ledgerId] });
      } else {
        const existing = groupedMap.get(key)!;
        existing.ledgerIds.push(r.ledgerId);
        existing.entries += r.entries;
        existing.debit += r.debit;
        existing.credit += r.credit;
        existing.balance += r.balance;
        existing.openingBalance += r.openingBalance;
        existing.usdDebit = (existing.usdDebit || 0) + (r.usdDebit || 0);
        existing.usdCredit = (existing.usdCredit || 0) + (r.usdCredit || 0);
        existing.usdBalance = (existing.usdBalance || 0) + (r.usdBalance || 0);
        
        if (r.lastActivityAt && (!existing.lastActivityAt || r.lastActivityAt > existing.lastActivityAt)) {
          existing.lastActivityAt = r.lastActivityAt;
          existing.lastReferenceNo = r.lastReferenceNo;
          existing.lastSource = r.lastSource;
          existing.lastDescription = r.lastDescription;
          existing.lastEntryDate = r.lastEntryDate;
        }
        
        if (existing.branch !== r.branch) {
          existing.branch = "Multiple Branches";
          existing.cityBranchId = null;
          existing.countryBranchId = null;
          existing.countryName = r.countryName === existing.countryName ? r.countryName : "Multiple Countries";
          existing.cityBranchName = null;
          existing.countryBranchName = null;
        }
      }
    }
    
    const finalRows = Array.from(groupedMap.values()).map(r => {
       const { ledgerIds, ...rest } = r;
       return { ...rest, ledgerId: ledgerIds.join(",") };
    }).filter(r => r.entries > 0 || r.openingBalance !== 0 || r.debit !== 0 || r.credit !== 0 || r.balance !== 0);

    const summary = finalRows.reduce(
      (acc, row) => {
        acc.totalLedgers += 1;
        if (row.status === "active") acc.activeLedgers += 1;
        else acc.inactiveLedgers += 1;
        acc.entries += row.entries;
        acc.debit += row.debit;
        acc.credit += row.credit;
        acc.balance += row.balance;
        return acc;
      },
      { totalLedgers: 0, activeLedgers: 0, inactiveLedgers: 0, entries: 0, debit: 0, credit: 0, balance: 0 }
    );

    const selectedLedger = query.ledgerId ? finalRows.find((row) => row.ledgerId === query.ledgerId) ?? null : null;

    const statement =
      query.ledgerId && selectedLedger
        ? await ledgerReportService.getLedgerStatement({
            session,
            ledgerId: query.ledgerId.split(","),
            fromDate,
            toDate,
            limit: 5000,
            language
          })
        : null;

    return apiOk({
      reportScope: query.reportScope,
      generatedAt: new Date().toISOString(),
      filters: {
        q: query.q ?? null,
        scope: query.scope ?? null,
        countryId: query.countryId ?? null,
        countryBranchId: query.countryBranchId ?? null,
        cityBranchId: query.cityBranchId ?? null,
        ledgerId: query.ledgerId ?? null,
        fromDate,
        toDate
      },
      summary,
      rows: finalRows,
      selectedLedger,
      statement
    });
  } catch (error) {
    return handleApiError(error);
  }
}

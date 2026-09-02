import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ledgerReportService } from "@/lib/services/ledger-report-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
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
  /** The single day whose Daily Credit/Debit/Balance the summary reports (defaults to toDate). */
  dailyDate: z.string().trim().min(8).optional(),
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
      dailyDate: request.nextUrl.searchParams.get("dailyDate") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    // Clamp the requested reportScope to what the session is actually entitled to —
    // the global (USD-consolidated) view is Super Admin only. resolveReportScope() is
    // the same helper every report handler uses. listLedgers still gates rows by the
    // session's own IDs regardless; this only affects presentation currency.
    const allowed = resolveReportScope(session).level; // "global" | "country" | "branch"
    query.reportScope = allowed === "global" ? query.reportScope : allowed === "country" ? "country" : "branch";

    const fromDate = query.fromDate ?? monthStartIso();
    const toDate = query.toDate ?? todayIso();
    const dailyDate = query.dailyDate && query.dailyDate >= fromDate && query.dailyDate <= toDate ? query.dailyDate : toDate;
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

    // ledger_balances / ledger_posting_lines / roznamcha_lines all have scoped RLS gated
    // on auth.uid(), which is NULL under this app's temp-session bootstrap — the Supabase
    // admin client silently returns zero rows here even though real postings exist
    // (confirmed live: rows came back from ledgerReportService.listLedgers() but every
    // ledger showed 0 entries / 0 balance, so the report's own "no entries" filter then
    // stripped every row). Same withLocalPg-primary bypass as ledger-report-service.ts.
    let batchLinesData: any[] = [];
    let rozLinesData: any[] = [];

    const viaPg = ledgerIds.length
      ? await withLocalPg(async (sql) => {
          const balanceRows = await sql`
            SELECT ledger_id, balance_date, debit_total, credit_total, closing_balance, updated_at
            FROM public.ledger_balances
            WHERE ledger_id = ANY(${ledgerIds}::uuid[])
            ORDER BY balance_date DESC
          `;
          const batchRows = await sql`
            SELECT lpl.ledger_id, lpl.description, lpl.debit, lpl.credit, lpl.currency, lpl.usd_rate, lpl.usd_amount, lpl.created_at,
                   lpb.entry_date AS batch_entry_date, lpb.reference_no AS batch_reference_no,
                   lpb.created_by AS batch_created_by, lpb.created_at AS batch_created_at
            FROM public.ledger_posting_lines lpl
            INNER JOIN public.ledger_posting_batches lpb ON lpb.id = lpl.batch_id
            WHERE lpl.ledger_id = ANY(${ledgerIds}::uuid[])
              AND lpb.entry_date >= ${fromDate} AND lpb.entry_date <= ${toDate}
            ORDER BY lpl.created_at ASC
          `;
          const rozRows = await sql`
            SELECT rl.ledger_id, rl.description, rl.debit, rl.credit, rl.currency, rl.usd_rate, rl.usd_amount,
                   re.entry_date AS entry_entry_date, re.voucher_no AS entry_voucher_no,
                   re.created_by AS entry_created_by, re.created_at AS entry_created_at
            FROM public.roznamcha_lines rl
            INNER JOIN public.roznamcha_entries re ON re.id = rl.roznamcha_entry_id
            WHERE rl.ledger_id = ANY(${ledgerIds}::uuid[])
              AND re.entry_date >= ${fromDate} AND re.entry_date <= ${toDate}
              AND re.deleted_at IS NULL
            ORDER BY re.entry_date ASC, re.created_at ASC, rl.id ASC
          `;
          return { balanceRows, batchRows, rozRows };
        })
      : null;

    if (viaPg) {
      for (const row of viaPg.balanceRows as any[]) {
        const ledgerId = row.ledger_id as string;
        if (balanceMap.has(ledgerId)) continue;
        balanceMap.set(ledgerId, {
          debit: toNumber(row.debit_total),
          credit: toNumber(row.credit_total),
          balance: toNumber(row.closing_balance),
          updatedAt: String(row.updated_at ?? ""),
          balanceDate: String(row.balance_date ?? "")
        });
      }
      batchLinesData = (viaPg.batchRows as any[]).map((row) => ({
        ledger_id: row.ledger_id,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        currency: row.currency,
        usd_rate: row.usd_rate,
        usd_amount: row.usd_amount,
        created_at: row.created_at,
        ledger_posting_batches: {
          entry_date: row.batch_entry_date,
          reference_no: row.batch_reference_no,
          created_by: row.batch_created_by,
          created_at: row.batch_created_at
        }
      }));
      rozLinesData = (viaPg.rozRows as any[]).map((row) => ({
        ledger_id: row.ledger_id,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        currency: row.currency,
        usd_rate: row.usd_rate,
        usd_amount: row.usd_amount,
        roznamcha_entries: {
          entry_date: row.entry_entry_date,
          voucher_no: row.entry_voucher_no,
          created_by: row.entry_created_by,
          created_at: row.entry_created_at
        }
      }));
    } else if (ledgerIds.length) {
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

      const [batchLinesRes, rozLinesRes] = await Promise.all([
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
      ]);

      if ((batchLinesRes as any).error) throw new Error((batchLinesRes as any).error.message);
      if ((rozLinesRes as any).error) throw new Error((rozLinesRes as any).error.message);
      batchLinesData = (batchLinesRes as any).data ?? [];
      rozLinesData = (rozLinesRes as any).data ?? [];
    }

    type AggRow = {
      entries: number;
      debit: number;
      credit: number;
      usdDebit: number;
      usdCredit: number;
      firstActivityAt: string | null;
      lastActivityAt: string | null;
      lastReferenceNo: string | null;
      lastSource: "ledger" | "roznamcha" | null;
      lastDescription: string | null;
      firstEntryDate: string | null;
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
          firstActivityAt: null,
          lastActivityAt: null,
          lastReferenceNo: null,
          lastSource: null,
          lastDescription: null,
          firstEntryDate: null,
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

    // Daily totals for the single day `dailyDate` — same historical per-line rate.
    // A separate local-currency bucket per currency keeps the branch/country view honest
    // (only the USD bucket is safe to sum across currencies).
    const daily = { entries: 0, debit: 0, credit: 0, usdDebit: 0, usdCredit: 0 };
    const dailyLocalByCcy = new Map<string, { debit: number; credit: number }>();
    function addDaily(entryDate: string | null, deb: number, cre: number, usdDeb: number, usdCre: number, ccy: string) {
      if (!entryDate || String(entryDate).slice(0, 10) !== dailyDate) return;
      daily.entries += 1;
      daily.debit += deb;
      daily.credit += cre;
      daily.usdDebit += usdDeb;
      daily.usdCredit += usdCre;
      const b = dailyLocalByCcy.get(ccy) ?? { debit: 0, credit: 0 };
      b.debit += deb;
      b.credit += cre;
      dailyLocalByCcy.set(ccy, b);
    }

    for (const row of batchLinesData) {
      const ledgerId = String(row.ledger_id);
      const entry = ensure(ledgerId);
      entry.entries += 1;
      const deb = toNumber(row.debit);
      const cre = toNumber(row.credit);
      entry.debit += deb;
      entry.credit += cre;
      const usdDeb = deb > 0 ? calcUsd(deb, row.usd_rate, row.usd_amount) : 0;
      const usdCre = cre > 0 ? calcUsd(cre, row.usd_rate, row.usd_amount) : 0;
      entry.usdDebit += usdDeb;
      entry.usdCredit += usdCre;
      addDaily(row.ledger_posting_batches?.entry_date ?? null, deb, cre, usdDeb, usdCre, String(row.currency || ""));

      const header = row.ledger_posting_batches ?? {};
      const activityAt = String(header.created_at ?? row.created_at ?? header.entry_date ?? "");
      const entryDate = header.entry_date ?? null;

      if (!entry.firstActivityAt || (activityAt && activityAt < entry.firstActivityAt)) {
        entry.firstActivityAt = activityAt;
        entry.firstEntryDate = entryDate;
      }
      if (!entry.lastActivityAt || (activityAt && activityAt > entry.lastActivityAt)) {
        entry.lastActivityAt = activityAt;
        entry.lastReferenceNo = header.reference_no ?? null;
        entry.lastSource = "ledger";
        entry.lastDescription = row.description ?? null;
        entry.lastEntryDate = entryDate;
      }
    }

    for (const row of rozLinesData) {
      const ledgerId = String(row.ledger_id);
      const entry = ensure(ledgerId);
      entry.entries += 1;
      const deb = toNumber(row.debit);
      const cre = toNumber(row.credit);
      entry.debit += deb;
      entry.credit += cre;
      const usdDeb = deb > 0 ? calcUsd(deb, row.usd_rate, row.usd_amount) : 0;
      const usdCre = cre > 0 ? calcUsd(cre, row.usd_rate, row.usd_amount) : 0;
      entry.usdDebit += usdDeb;
      entry.usdCredit += usdCre;
      addDaily(row.roznamcha_entries?.entry_date ?? null, deb, cre, usdDeb, usdCre, String(row.currency || ""));

      const header = row.roznamcha_entries ?? {};
      const activityAt = String(header.created_at ?? row.created_at ?? header.entry_date ?? "");
      const entryDate = header.entry_date ?? null;

      if (!entry.firstActivityAt || (activityAt && activityAt < entry.firstActivityAt)) {
        entry.firstActivityAt = activityAt;
        entry.firstEntryDate = entryDate;
      }
      if (!entry.lastActivityAt || (activityAt && activityAt > entry.lastActivityAt)) {
        entry.lastActivityAt = activityAt;
        entry.lastReferenceNo = header.voucher_no ?? null;
        entry.lastSource = "roznamcha";
        entry.lastDescription = row.description ?? null;
        entry.lastEntryDate = entryDate;
      }
    }

    const rowsWithTotals = rows.map((row) => {
      const totals = agg.get(row.ledgerId) ?? { entries: 0, debit: 0, credit: 0, usdDebit: 0, usdCredit: 0, firstActivityAt: null, lastActivityAt: null, lastReferenceNo: null, lastSource: null, lastDescription: null, firstEntryDate: null, lastEntryDate: null };
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
        firstActivityAt: totals.firstActivityAt,
        lastActivityAt: totals.lastActivityAt,
        lastReferenceNo: totals.lastReferenceNo,
        lastSource: totals.lastSource,
        lastDescription: totals.lastDescription,
        firstEntryDate: totals.firstEntryDate,
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
        
        if (r.firstActivityAt && (!existing.firstActivityAt || r.firstActivityAt < existing.firstActivityAt)) {
          existing.firstActivityAt = r.firstActivityAt;
          existing.firstEntryDate = r.firstEntryDate;
        }
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
        acc.usdDebit += row.usdDebit || 0;
        acc.usdCredit += row.usdCredit || 0;
        acc.usdBalance += row.usdBalance || 0;
        return acc;
      },
      { totalLedgers: 0, activeLedgers: 0, inactiveLedgers: 0, entries: 0, debit: 0, credit: 0, balance: 0, usdDebit: 0, usdCredit: 0, usdBalance: 0 }
    );

    // ── Scope-aware presentation currency ───────────────────────────────────
    // super_admin consolidates in USD; country / branch stay in the dominant
    // local currency of the returned ledgers (never invented — read off the rows).
    const ccyCount = new Map<string, number>();
    for (const r of finalRows) {
      const c = String((r as any).ledgerCurrency || "").toUpperCase();
      if (c) ccyCount.set(c, (ccyCount.get(c) || 0) + 1);
    }
    const dominantCurrency =
      [...ccyCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      (finalRows[0] as any)?.ledgerCurrency ||
      "USD";
    const displayCurrency = query.reportScope === "super_admin" ? "USD" : dominantCurrency;
    const mixedLocalCurrency = ccyCount.size > 1;

    // Daily local total is only meaningful when the day's entries are single-currency.
    const dailyCurrencies = [...dailyLocalByCcy.keys()].filter(Boolean);
    const dailyLocal =
      dailyCurrencies.length === 1
        ? dailyLocalByCcy.get(dailyCurrencies[0])!
        : { debit: daily.debit, credit: daily.credit };

    Object.assign(summary, {
      // daily (single day = dailyDate)
      dailyDate,
      dailyEntries: daily.entries,
      dailyDebit: dailyLocal.debit,
      dailyCredit: dailyLocal.credit,
      dailyBalance: dailyLocal.credit - dailyLocal.debit,
      dailyUsdDebit: daily.usdDebit,
      dailyUsdCredit: daily.usdCredit,
      dailyUsdBalance: daily.usdCredit - daily.usdDebit,
      // presentation
      displayCurrency,
      dominantCurrency,
      mixedLocalCurrency,
      reportScope: query.reportScope,
    });

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

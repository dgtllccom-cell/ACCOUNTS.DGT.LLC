import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type QueryResult<T = unknown> = Promise<{ data: T | null; error: { message: string } | null }>;

type LooseMutationFilter = {
  eq(column: string, value: string | boolean | number): LooseMutationFilter;
  select(columns?: string): {
    single(): QueryResult;
  };
} & QueryResult;

type LooseQueryBuilder = {
  select(columns?: string): LooseQueryBuilder;
  insert(values: unknown): {
    select(columns?: string): {
      single(): QueryResult;
    };
  } & QueryResult;
  upsert(values: unknown, options?: unknown): {
    select(columns?: string): {
      single(): QueryResult;
    };
  } & QueryResult;
  update(values: unknown): LooseMutationFilter;
  delete(): LooseMutationFilter;
  eq(column: string, value: string | boolean | number): LooseQueryBuilder;
  in(column: string, values: Array<string | number | boolean>): LooseQueryBuilder;
  is(column: string, value: null): LooseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): LooseQueryBuilder;
  limit(count: number): QueryResult<unknown[]>;
  maybeSingle(): QueryResult;
  single(): QueryResult;
};

export type LooseSupabaseClient = {
  from(table: string): LooseQueryBuilder;
  rpc(functionName: string, args?: Record<string, unknown>): QueryResult;
};

export async function createApiSupabaseClient() {
  // API routes call `requireErpSession` + `authorizeApiScope` before reaching
  // database writes. Use the service-role client here so temp ERP sessions and
  // route-level authorization can persist records even without a Supabase Auth
  // JWT cookie.
  return createSupabaseAdminClient() as unknown as LooseSupabaseClient;
}

export async function requireSupabaseData<T>(
  result: Promise<{ data: T | null; error: { message: string } | null }>
) {
  const { data, error } = await result;

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function writeAuditLog(input: {
  action: string;
  entityTable: string;
  entityId?: string | null;
  companyId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}) {
  // Preferred path: database RPC writes actor_id from auth.uid().
  // During initial bootstrap we may only have the temp ERP session cookie (no Supabase JWT),
  // so we fall back to a privileged insert with actor_id=null.
  //
  // Both paths are wrapped so a logging failure can NEVER fail the caller's actual business
  // write (customer/company/order/etc. already committed by the time this runs). Confirmed this
  // was happening in practice: write_erp_audit_log() hard-requires auth.uid() (raises
  // "Authentication is required" for the temp-session bootstrap login, which has no real
  // Supabase JWT), and the admin-client fallback insert then hit audit_logs' RLS policy too —
  // together turning a pure observability failure into a 500 on legitimate creates/updates.
  try {
    const supabase = await createApiSupabaseClient();

    const { error } = await supabase.rpc("write_erp_audit_log", {
      p_action: input.action,
      p_entity_table: input.entityTable,
      p_entity_id: input.entityId ?? null,
      p_before: input.before ?? null,
      p_after: input.after ?? null,
      p_company_id: input.companyId ?? null,
      p_ip_address: input.ipAddress ?? null
    });

    if (!error) return;
    throw new Error(error.message);
  } catch (error) {
    try {
      const admin = createSupabaseAdminClient() as any;
      const { error: insertError } = await admin.from("audit_logs").insert({
        company_id: input.companyId ?? null,
        actor_id: null,
        action: input.action,
        entity_table: input.entityTable,
        entity_id: input.entityId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        ip_address: input.ipAddress ?? null
      });

      if (insertError) throw new Error(insertError.message);
    } catch (fallbackError) {
      console.error("[writeAuditLog] Non-fatal: audit log write failed on both RPC and fallback paths:", error, fallbackError);
    }
  }
}

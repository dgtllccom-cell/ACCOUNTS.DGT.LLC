"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountFormSchema } from "@/features/accounts/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeAccountPrefix(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

async function nextFoundationAccountCode(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  companyId: string,
  branchId: string | undefined
) {
  let prefix = "SA-AC";

  if (branchId) {
    const { data: branch } = await supabase
      .from("branches")
      .select("code")
      .eq("id", branchId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (branch?.code) prefix = `${normalizeAccountPrefix(branch.code)}-AC`;
  }

  const { data: latest } = await supabase
    .from("accounts")
    .select("code")
    .eq("company_id", companyId)
    .ilike("code", `${prefix}-%`)
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = typeof latest?.code === "string" ? latest.code.match(/(\d+)$/)?.[1] : null;
  const next = String((last ? Number(last) : 0) + 1).padStart(4, "0");
  return `${prefix}-${next}`;
}

export async function createAccount(formData: FormData) {
  const input = accountFormSchema.parse({
    companyId: formData.get("companyId"),
    branchId: formData.get("branchId") || "",
    parentId: formData.get("parentId") || "",
    code: formData.get("code"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    currency: formData.get("currency"),
    isControlAccount: formData.get("isControlAccount") === "on"
  });

  const supabase = await createServerSupabaseClient();
  const issuedCode =
    input.code.trim().toUpperCase() === "AUTO"
      ? await nextFoundationAccountCode(supabase, input.companyId, input.branchId || undefined)
      : input.code;

  const { error } = await supabase.rpc("create_account", {
    target_company_id: input.companyId,
    target_branch_id: input.branchId || null,
    parent_account_id: input.parentId || null,
    account_code: issuedCode,
    account_name: input.name,
    account_kind_value: input.kind,
    account_currency: input.currency,
    is_control: input.isControlAccount
  });

  if (error) {
    redirect(`/dashboard/accounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/accounts");
}

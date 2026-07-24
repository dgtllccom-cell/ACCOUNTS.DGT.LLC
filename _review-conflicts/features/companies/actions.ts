"use server";

import { redirect } from "next/navigation";
import { workspaceSetupSchema } from "@/features/companies/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const input = workspaceSetupSchema.parse({
    companyName: formData.get("companyName"),
    legalName: formData.get("legalName") || undefined,
    baseCurrency: formData.get("baseCurrency"),
    branchName: formData.get("branchName"),
    branchCode: formData.get("branchCode"),
    ownerFullName: formData.get("ownerFullName")
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_company_workspace", {
    company_name: input.companyName,
    legal_name: input.legalName ?? null,
    base_currency: input.baseCurrency,
    branch_name: input.branchName,
    branch_code: input.branchCode,
    owner_full_name: input.ownerFullName
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

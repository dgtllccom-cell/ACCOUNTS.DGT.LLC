"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const postJournalSchema = z.object({
  journalEntryId: z.string().uuid()
});

export async function postJournalEntry(input: z.infer<typeof postJournalSchema>) {
  const { journalEntryId } = postJournalSchema.parse(input);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("post_journal_entry", {
    target_journal_entry_id: journalEntryId
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
}

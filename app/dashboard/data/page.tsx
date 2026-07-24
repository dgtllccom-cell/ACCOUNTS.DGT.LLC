import { DataPageClient } from "@/features/data/components/data-page-client";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export default async function DataPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const params = (await searchParams) ?? {};
  const lang = ((params.lang as SupportedLanguage) || "en") as SupportedLanguage;
  return <DataPageClient lang={lang} />;
}
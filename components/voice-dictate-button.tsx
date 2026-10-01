"use client";

import type { VoiceContext } from "@/lib/services/voice-context-interpreter";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { VoiceRemarksMic } from "@/components/erp/voice-remarks-mic";

/**
 * VoiceDictateButton — lightweight "dictate into one plain field" control.
 * Powered by enterprise VoiceRemarksMic supporting:
 * - Start / Pause / Resume / Stop
 * - Live recording indicator
 * - Transcript preview modal with inline edit
 * - Replace or Append options
 * - 5 languages verbatim (no silent changes)
 */
export function VoiceDictateButton({
  context = "accounts",
  lang: langProp,
  value,
  onChange,
  className = "",
  disabled = false,
}: {
  context?: VoiceContext;
  lang?: SupportedLanguage;
  value: string | null | undefined;
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <VoiceRemarksMic
      context={context}
      lang={langProp}
      value={value}
      onChange={onChange}
      className={className}
      disabled={disabled}
    />
  );
}

export { VoiceRemarksMic };

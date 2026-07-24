/**
 * Utility to parse structured narration strings containing Details and Remarks.
 * Handles backward compatibility by defaulting to whole string as Remarks if not structured.
 */
export function parseNarration(narration: string | null | undefined): { details: string; remarks: string } {
  if (!narration) {
    return { details: "", remarks: "" };
  }

  const trimmed = narration.trim();
  if (trimmed.startsWith("Details: ")) {
    const parts = trimmed.split("\nRemarks: ");
    const details = parts[0]!.replace(/^Details:\s*/, "").trim();
    const remarks = parts.slice(1).join("\nRemarks: ").trim();
    return { details, remarks };
  }

  return { details: "", remarks: trimmed };
}

import type { DocumentAiProvider } from "../types";
import { LocalDocumentAiProvider } from "./local";
import { ExternalDocumentAiProviderStub } from "./external-stub";

/**
 * Provider registry. `local` is the default + complete working path. An external
 * provider is only selected when explicitly configured AND explicitly approved.
 */
let cached: DocumentAiProvider | null = null;

export function getDocumentAiProvider(): DocumentAiProvider {
  if (cached) return cached;
  const want = (process.env.DOC_INTAKE_PROVIDER || "local").toLowerCase();
  const approved = process.env.DOC_INTAKE_EXTERNAL_APPROVED === "1";
  if (want === "external" && approved) {
    cached = new ExternalDocumentAiProviderStub();
  } else {
    cached = new LocalDocumentAiProvider();
  }
  return cached;
}

export function resetDocumentAiProvider() {
  cached = null;
}

import type { DocumentAiProvider, IngestResult, ClassificationResult, ExtractionResult, RegistryDocType, OperationalDomain, OcrPage } from "../types";

/**
 * Placeholder for an approved external document-AI provider. It is NEVER used
 * unless BOTH:
 *   - DOC_INTAKE_PROVIDER=external is set, and
 *   - DOC_INTAKE_EXTERNAL_APPROVED=1 is set (an explicit operator approval flag)
 * Until a real adapter is wired here, every method throws so the engine falls
 * back to `local`.
 */
export class ExternalDocumentAiProviderStub implements DocumentAiProvider {
  readonly name = "external";
  private fail(): never {
    throw new Error(
      "External document-AI provider is not configured. Local processing is the default and complete path. " +
        "To connect an approved provider, implement lib/document-intelligence/providers/external-stub.ts and set " +
        "DOC_INTAKE_PROVIDER=external + DOC_INTAKE_EXTERNAL_APPROVED=1.",
    );
  }
  ingest(): Promise<IngestResult> { return this.fail(); }
  classify(_t: string, _r: RegistryDocType[], _d?: OperationalDomain | null): Promise<ClassificationResult> { return this.fail(); }
  extract(_i: { text: string; pages: OcrPage[]; docType: RegistryDocType }): Promise<ExtractionResult> { return this.fail(); }
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { getExpectedTwilioSignature } from "twilio/lib/webhooks/webhooks";
import { getTelephonyAdapter } from "@/lib/ai-receptionist/provider";
const url = "https://dev.example.test/api/erp/ai-calls/webhook";
const params = { CallSid: "CAexample", From: "+971500000000", To: "+971511111111", SpeechResult: "Need a shipping quote" };
const body = new URLSearchParams(params).toString();
function setup() {
  vi.stubEnv("AI_CALL_PROVIDER", "twilio");
  vi.stubEnv("AI_CALL_AUTH_TOKEN", "test-token-not-a-real-credential");
  vi.stubEnv("AI_CALL_WEBHOOK_URL", "");
  return { adapter: getTelephonyAdapter()!, headers: {
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "x-twilio-signature": getExpectedTwilioSignature("test-token-not-a-real-credential", url, params),
  } };
}
afterEach(() => vi.unstubAllEnvs());
describe("AI call provider verifies signed requests before inquiry writes", () => {
  it("accepts a correctly signed form and rejects a modified transcript", () => {
    const { adapter, headers } = setup();
    expect(adapter.verifySignature(body, headers, url)).toBe(true);
    expect(adapter.verifySignature(body.replace("shipping", "payment"), headers, url)).toBe(false);
  });
  it("rejects absent, arbitrary and wrong-key signatures", () => {
    const { adapter, headers } = setup();
    for (const signature of ["", "anything", getExpectedTwilioSignature("wrong-token", url, params)]) {
      expect(adapter.verifySignature(body, { ...headers, "x-twilio-signature": signature }, url)).toBe(false);
    }
  });
  it("rejects a missing auth token even when a signature header exists", () => {
    const { adapter, headers } = setup(); vi.stubEnv("AI_CALL_AUTH_TOKEN", "");
    expect(adapter.verifySignature(body, headers, url)).toBe(false);
  });
  it("validates the URL and content type, with a trusted public URL for reverse proxies", () => {
    const { adapter, headers } = setup();
    expect(adapter.verifySignature(body, headers, url + "?changed=1")).toBe(false);
    expect(adapter.verifySignature(body, { ...headers, "content-type": "application/json" }, url)).toBe(false);
    vi.stubEnv("AI_CALL_WEBHOOK_URL", url);
    expect(adapter.verifySignature(body, headers, "http://localhost:3000/api/erp/ai-calls/webhook")).toBe(true);
  });
});

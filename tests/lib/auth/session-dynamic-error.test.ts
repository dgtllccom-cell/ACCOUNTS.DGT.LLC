import { beforeEach, describe, expect, it, vi } from "vitest";

const { readTempSessionMock } = vi.hoisted(() => ({
  readTempSessionMock: vi.fn()
}));

vi.mock("@/lib/auth/temp-session", () => ({
  readTempSession: readTempSessionMock
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => false
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn()
}));

import { getCurrentErpSession } from "@/lib/auth/session";

describe("getCurrentErpSession dynamic usage handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rethrows Next.js dynamic server usage errors", async () => {
    const dynamicError = Object.assign(new Error("Dynamic server usage: Route /mobile couldn't be rendered statically"), {
      digest: "DYNAMIC_SERVER_USAGE"
    });
    readTempSessionMock.mockRejectedValueOnce(dynamicError);

    await expect(getCurrentErpSession()).rejects.toBe(dynamicError);
  });

  it("keeps returning null for non-dynamic session errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readTempSessionMock.mockRejectedValueOnce(new Error("Unexpected session failure"));

    await expect(getCurrentErpSession()).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

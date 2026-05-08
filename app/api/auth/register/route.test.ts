import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
  getSupabaseServerUrl: vi.fn(),
  getAgreementConfig: vi.fn(),
  getDefaultAgreementConfig: vi.fn(),
  acceptUserAgreement: vi.fn(),
  getClientIpAddress: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getSupabaseAnonKey: mocks.getSupabaseAnonKey,
  getSupabaseServerUrl: mocks.getSupabaseServerUrl,
}));

vi.mock("@/lib/legalSettings", () => ({
  getAgreementConfig: mocks.getAgreementConfig,
}));

vi.mock("@/lib/legal", () => ({
  acceptUserAgreement: mocks.acceptUserAgreement,
  getClientIpAddress: mocks.getClientIpAddress,
  getDefaultAgreementConfig: mocks.getDefaultAgreementConfig,
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth register route", () => {
  it("creates auth users without writing RBAC fields into auth metadata", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user_1", user_metadata: { full_name: "Jane Field" } } },
      error: null,
    });
    const publicClient = {
      auth: { signUp },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mocks.createClient.mockReturnValue(publicClient);
    mocks.createSupabaseAdminClient.mockReturnValue(null);
    mocks.getSupabaseServerUrl.mockReturnValue("https://example.supabase.co");
    mocks.getSupabaseAnonKey.mockReturnValue("anon");
    mocks.getAgreementConfig.mockResolvedValue({ version: "agreement-v1" });
    mocks.getDefaultAgreementConfig.mockReturnValue({ version: "agreement-v1" });
    mocks.getClientIpAddress.mockReturnValue("127.0.0.1");
    mocks.acceptUserAgreement.mockResolvedValue({ error: null });

    const response = await POST(
      new Request("https://example.com/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: "Jane Field",
          email: "jane@example.com",
          password: "Password123!",
          agreed: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(signUp).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Password123!",
      options: {
        data: { full_name: "Jane Field" },
      },
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getSupabaseServerEnvStatus: vi.fn(),
  getAgreementConfig: vi.fn(),
  getDefaultAgreementConfig: vi.fn(),
  acceptUserAgreement: vi.fn(),
  getClientIpAddress: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getSupabaseServerEnvStatus: mocks.getSupabaseServerEnvStatus,
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

describe("company register route", () => {
  it("creates the auth user and signup request without writing user_roles", async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table !== "company_signup_requests") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return { insert };
    });

    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user_1" } },
      error: null,
    });

    const adminClient = {
      auth: {
        admin: {
          createUser,
        },
      },
      from,
    };

    mocks.createSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.getSupabaseServerEnvStatus.mockReturnValue({
      url: true,
      anonKey: true,
      serviceRoleKey: true,
    });
    mocks.getAgreementConfig.mockResolvedValue({ version: "agreement-v1" });
    mocks.getDefaultAgreementConfig.mockReturnValue({ version: "agreement-v1" });
    mocks.getClientIpAddress.mockReturnValue("127.0.0.1");
    mocks.acceptUserAgreement.mockResolvedValue({ error: null });

    const response = await POST(
      new Request("https://example.com/api/auth/company-register", {
        method: "POST",
        body: JSON.stringify({
          companyName: "Acme Safety",
          industry: "Construction",
          phone: "555-123-4567",
          addressLine1: "100 Main St",
          city: "Milwaukee",
          stateRegion: "WI",
          postalCode: "53202",
          country: "United States",
          fullName: "Jordan Owner",
          email: "owner@example.com",
          password: "Password123!",
          agreed: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("company_signup_requests");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(mocks.acceptUserAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase: adminClient,
        userId: "user_1",
        ipAddress: "127.0.0.1",
        termsVersion: "agreement-v1",
      })
    );

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.warning).toBeNull();
  });
});

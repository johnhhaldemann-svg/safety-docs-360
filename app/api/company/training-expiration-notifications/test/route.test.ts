import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  isCompanyRole: vi.fn(),
  getCompanyScope: vi.fn(),
  canMutateCompanyTrainingRequirements: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  sendTrainingExpirationEmail: vi.fn(),
  loadTrainingExpirationItems: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
  isCompanyRole: mocks.isCompanyRole,
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/companyTrainingAccess", () => ({
  canMutateCompanyTrainingRequirements: mocks.canMutateCompanyTrainingRequirements,
}));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/trainingExpirationEmail", () => ({
  sendTrainingExpirationEmail: mocks.sendTrainingExpirationEmail,
}));
vi.mock("@/lib/trainingExpirationNotifications", () => ({
  loadTrainingExpirationItems: mocks.loadTrainingExpirationItems,
}));

import { POST } from "./route";

function request() {
  return new Request("https://example.com/api/company/training-expiration-notifications/test", {
    method: "POST",
  });
}

describe("POST /api/company/training-expiration-notifications/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue({
      role: "safety_manager",
      permissionMap: {},
      team: "Summit Builders",
      supabase: { from: vi.fn() },
      user: {
        id: "user-1",
        email: "safety@example.com",
        user_metadata: { full_name: "Safety Manager" },
      },
    });
    mocks.isCompanyRole.mockReturnValue(true);
    mocks.getCompanyScope.mockResolvedValue({
      companyId: "company-1",
      companyName: "Summit Builders",
    });
    mocks.canMutateCompanyTrainingRequirements.mockReturnValue(true);
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.sendTrainingExpirationEmail.mockResolvedValue({
      sent: true,
      status: "sent",
      providerMessageId: "email-1",
    });
    mocks.loadTrainingExpirationItems.mockResolvedValue({ items: [{ id: "item-1" }], warnings: [] });
  });

  it("sends a synthetic training expiration email to the current user", async () => {
    const response = (await POST(request()))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      status: "sent",
      recipientEmail: "safety@example.com",
      realExpirationItemsSeen: 1,
    });
    expect(mocks.sendTrainingExpirationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "safety@example.com",
        companyName: "Summit Builders",
        workerItems: expect.arrayContaining([
          expect.objectContaining({ trainingTitle: "SafetyDocs360 test renewal", stage: "7d" }),
        ]),
        managerItems: expect.arrayContaining([
          expect.objectContaining({ trainingTitle: "Example expired training", stage: "expired" }),
        ]),
      })
    );
    expect(mocks.loadTrainingExpirationItems).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { id: "company-1", name: "Summit Builders" },
      })
    );
  });

  it("rejects users who cannot manage training notifications", async () => {
    mocks.canMutateCompanyTrainingRequirements.mockReturnValue(false);

    const response = (await POST(request()))!;

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Only company admins, managers, and safety managers can send training notification tests.",
    });
    expect(mocks.sendTrainingExpirationEmail).not.toHaveBeenCalled();
  });

  it("surfaces missing service-role config", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);

    const response = (await POST(request()))!;

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "Missing Supabase service role key for training expiration notification tests.",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  canMutateCompanyTrainingRequirements,
  createSupabaseAdminClient,
  extractTrainingRecordFromPhoto,
  getCompanyScope,
  isCompanyRole,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  canMutateCompanyTrainingRequirements: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  extractTrainingRecordFromPhoto: vi.fn(),
  getCompanyScope: vi.fn(),
  isCompanyRole: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest, isCompanyRole }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyTrainingAccess", () => ({ canMutateCompanyTrainingRequirements }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/trainingRecordPhotoExtraction", () => ({ extractTrainingRecordFromPhoto }));

import { POST } from "./route";

const routeContext = { params: Promise.resolve({ id: "employee-1" }) };
const aiMeta = {
  model: "gpt-4o-mini",
  provider: "openai",
  promptHash: "hash",
  fallbackUsed: false,
  fallbackReason: null,
  attempts: 1,
  latencyMs: 10,
  usage: null,
  surface: "training-records.photo-extract",
};

function employeeSupabase(data: Record<string, unknown> | null = { id: "employee-1", full_name: "Jordan Lee" }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return {
    from: vi.fn(() => builder),
    builder,
  };
}

function makeRequest(file?: File) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("https://example.com/api/company/tracked-employees/employee-1/training-records/extract-photo", {
    method: "POST",
    body: form,
  });
}

describe("/api/company/tracked-employees/[id]/training-records/extract-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCompanyRole.mockReturnValue(true);
    createSupabaseAdminClient.mockReturnValue(null);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    canMutateCompanyTrainingRequirements.mockReturnValue(true);
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1", email: "admin@example.com" },
      team: "Builder Co",
      permissionMap: {},
      supabase: employeeSupabase(),
    });
    extractTrainingRecordFromPhoto.mockResolvedValue({
      draft: {
        title: "OSHA 10 Construction",
        completedOn: "2025-06-11",
        expiresOn: "2027-06-11",
        provider: "ABC Safety",
        notes: "Card #12345",
        confidence: 0.91,
        warnings: [],
      },
      meta: aiMeta,
      error: null,
    });
  });

  it("rejects users who cannot mutate training records", async () => {
    canMutateCompanyTrainingRequirements.mockReturnValue(false);

    const response = requireRouteResponse(
      await POST(makeRequest(new File(["png"], "card.png", { type: "image/png" })), routeContext)
    );

    expect(response.status).toBe(403);
    expect(extractTrainingRecordFromPhoto).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads", async () => {
    const response = requireRouteResponse(
      await POST(makeRequest(new File(["hello"], "card.txt", { type: "text/plain" })), routeContext)
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Training card upload must be an image." });
    expect(extractTrainingRecordFromPhoto).not.toHaveBeenCalled();
  });

  it("returns 404 when the tracked employee is missing", async () => {
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      user: { id: "admin-1" },
      team: "Builder Co",
      permissionMap: {},
      supabase: employeeSupabase(null),
    });

    const response = requireRouteResponse(
      await POST(makeRequest(new File(["png"], "card.png", { type: "image/png" })), routeContext)
    );

    expect(response.status).toBe(404);
    expect(extractTrainingRecordFromPhoto).not.toHaveBeenCalled();
  });

  it("returns a clear error when AI extraction fails", async () => {
    extractTrainingRecordFromPhoto.mockResolvedValue({
      draft: null,
      meta: { ...aiMeta, fallbackUsed: true, fallbackReason: "no_openai_api_key" },
      error: "AI could not read this training image. You can still enter the record manually.",
    });

    const response = requireRouteResponse(
      await POST(makeRequest(new File(["png"], "card.png", { type: "image/png" })), routeContext)
    );
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toMatch(/AI could not read/);
  });

  it("returns a normalized draft without storing the uploaded image", async () => {
    const response = requireRouteResponse(
      await POST(makeRequest(new File(["png"], "card.png", { type: "image/png" })), routeContext)
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.draft).toMatchObject({
      title: "OSHA 10 Construction",
      completedOn: "2025-06-11",
      expiresOn: "2027-06-11",
      provider: "ABC Safety",
    });
    expect(extractTrainingRecordFromPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "card.png",
        employeeName: "Jordan Lee",
      })
    );
    expect(extractTrainingRecordFromPhoto.mock.calls[0]?.[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

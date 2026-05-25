import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  getCompanyScope: vi.fn(),
  runGusPhotoReview: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest: mocks.authorizeRequest }));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope: mocks.getCompanyScope }));
vi.mock("@/lib/gus/gusPhotoReview", () => ({ runGusPhotoReview: mocks.runGusPhotoReview }));

import { POST } from "@/app/api/gus/photo-review/route";

const aiMeta = {
  model: "gpt-4.1-mini",
  provider: "openai",
  promptHash: "hash",
  fallbackUsed: false,
  fallbackReason: null,
  attempts: 1,
  latencyMs: 10,
  usage: null,
  surface: "gus.photo-review",
};

function photoRequest(file?: File, fields: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new Request("http://localhost/api/gus/photo-review", {
    method: "POST",
    body: form,
  });
}

describe("/api/gus/photo-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user-1", email: "safety@example.com" },
      role: "company_admin",
      team: "Builder Co",
      permissionMap: {},
    });
    mocks.getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
    mocks.runGusPhotoReview.mockResolvedValue({
      output: {
        answer: "Visible housekeeping needs review.",
        riskLevel: "moderate",
        whatLooksRight: ["Access path appears marked"],
        concerns: ["Loose material in walkway"],
        criticalFlags: [],
        missingInformation: ["Task being performed"],
        recommendedControls: ["Clear walking path"],
        nextActions: ["Have a human reviewer verify the area"],
        limitations: ["Only visible conditions were reviewed"],
        confidence: 0.72,
        draftOnly: true,
        humanReviewRequired: true,
      },
      validationFindings: [],
      meta: aiMeta,
      rawText: "{}",
      error: null,
    });
  });

  it("rejects missing uploads without calling AI", async () => {
    const response = requireRouteResponse(await POST(photoRequest()));

    expect(response.status).toBe(400);
    expect(mocks.runGusPhotoReview).not.toHaveBeenCalled();
  });

  it("rejects unsupported uploads without calling AI", async () => {
    const response = requireRouteResponse(await POST(photoRequest(new File(["text"], "note.txt", { type: "text/plain" }))));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Gus can review PNG, JPEG, or WEBP photos." });
    expect(mocks.runGusPhotoReview).not.toHaveBeenCalled();
  });

  it("rejects empty uploads without calling AI", async () => {
    const response = requireRouteResponse(await POST(photoRequest(new File([], "empty.png", { type: "image/png" }))));

    expect(response.status).toBe(400);
    expect(mocks.runGusPhotoReview).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads without calling AI", async () => {
    const bytes = new Uint8Array(8 * 1024 * 1024 + 1);
    const response = requireRouteResponse(await POST(photoRequest(new File([bytes], "large.png", { type: "image/png" }))));

    expect(response.status).toBe(413);
    expect(mocks.runGusPhotoReview).not.toHaveBeenCalled();
  });

  it("returns Gus photo review output without storing the image", async () => {
    const response = requireRouteResponse(
      await POST(
        photoRequest(new File(["png"], "deck.png", { type: "image/png" }), {
          message: "Check the deck edge.",
          context: JSON.stringify({ currentPage: "SafePredict", route: "/safe-predict" }),
        }),
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      answer: "Visible housekeeping needs review.",
      riskLevel: "moderate",
      draftOnly: true,
      humanReviewRequired: true,
    });
    expect(mocks.runGusPhotoReview).toHaveBeenCalledWith(
      expect.objectContaining({
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
        fileName: "deck.png",
        message: "Check the deck edge.",
        context: expect.objectContaining({
          companyId: "company-1",
          userId: "user-1",
          currentPage: "SafePredict",
        }),
      }),
    );
  });
});

import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadinessRow, ReadinessSummary } from "@/lib/readinessMatrix";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/companyTrainingAccess", () => ({
  canViewCompanyTrainingMatrix: vi.fn(),
}));

vi.mock("@/lib/ai/defaultModel", () => ({
  resolveCompanyAiDefaultModel: vi.fn(() => "gpt-4o-mini"),
}));

vi.mock("@/lib/ai/responses", () => ({
  requestAiResponsesText: vi.fn(),
}));

import { POST } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import { canViewCompanyTrainingMatrix } from "@/lib/companyTrainingAccess";
import { requestAiResponsesText } from "@/lib/ai/responses";

const summary: ReadinessSummary = {
  total: 1,
  ready: 0,
  expiringSoon: 0,
  gap: 1,
  blocked: 0,
  needsReview: 0,
  employees: 1,
  contractors: 0,
};

const rows: ReadinessRow[] = [
  {
    id: "employee:u1",
    personType: "employee",
    personId: "u1",
    name: "Maria L.",
    email: "maria@example.com",
    role: "employee",
    trade: "Steel",
    position: "Foreman",
    jobsiteId: null,
    jobsiteName: null,
    deterministicStatus: "gap",
    status: "gap",
    readinessScore: 58,
    blockers: [],
    gaps: [
      {
        type: "gap",
        label: "Fall Protection",
        detail: "Missing in-scope requirement: Fall Protection.",
        requirementId: "r1",
      },
    ],
    expiring: [],
    reviewItems: [],
    source: {
      trainingRequirements: 1,
      contractorTrainingRequirements: 0,
      inductionRequirements: 0,
      operationalSignals: 0,
    },
    recommendedNextAction: "Close training and credential gaps before assigning work.",
  },
];

function request(body: unknown) {
  return new Request("https://example.com/api/company/training-matrix/readiness/ai-review", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function expectResponse(response: Response | undefined) {
  if (!response) throw new Error("missing response");
  return response;
}

describe("/api/company/training-matrix/readiness/ai-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "company_admin",
      team: "Ops",
      user: { id: "u1" },
      supabase: {},
    } as never);
    vi.mocked(canViewCompanyTrainingMatrix).mockReturnValue(true);
  });

  it("returns auth errors before running AI", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);

    const res = expectResponse(await POST(request({ summary, rows })));

    expect(res.status).toBe(401);
    expect(requestAiResponsesText).not.toHaveBeenCalled();
  });

  it("blocks roles without training matrix access", async () => {
    vi.mocked(canViewCompanyTrainingMatrix).mockReturnValue(false);

    const res = expectResponse(await POST(request({ summary, rows })));

    expect(res.status).toBe(403);
    expect(requestAiResponsesText).not.toHaveBeenCalled();
  });

  it("returns deterministic fallback when AI returns no text", async () => {
    vi.mocked(requestAiResponsesText).mockResolvedValue({
      text: null,
      meta: { fallbackReason: "no_openai_api_key" },
    } as never);

    const res = expectResponse(await POST(request({ summary, rows })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.review.fallbackUsed).toBe(true);
    expect(body.review.fallbackReason).toBe("no_openai_api_key");
    expect(body.review.rowFindings[0].status).toBe("gap");
    expect(requestAiResponsesText).toHaveBeenCalledWith(
      expect.objectContaining({ surface: "readiness-matrix.ai-review" })
    );
  });

  it("parses bounded AI JSON responses", async () => {
    vi.mocked(requestAiResponsesText).mockResolvedValue({
      text: JSON.stringify({
        overallScore: 64.4,
        summary: "Prioritize the open training gap.",
        prioritizedActions: ["Assign Fall Protection training."],
        rowFindings: [
          {
            rowId: "employee:u1",
            status: "needs_review",
            score: 61.8,
            explanation: "The worker has one required training gap.",
            confidence: 0.7,
          },
        ],
      }),
      meta: {},
    } as never);

    const res = expectResponse(await POST(request({ summary, rows })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.review.overallScore).toBe(64);
    expect(body.review.rowFindings[0]).toMatchObject({
      rowId: "employee:u1",
      status: "needs_review",
      score: 62,
      confidence: 0.7,
    });
  });
});

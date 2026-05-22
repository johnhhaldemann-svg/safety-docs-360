import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
  isAdminRole: vi.fn(() => false),
  normalizeAppRole: vi.fn((role: string | null | undefined) => role ?? "viewer"),
}));

import { POST as createDraftJsa } from "@/app/api/gus/planning/create-draft-jsa/route";
import { POST as createDraftPermitChecklist } from "@/app/api/gus/planning/create-draft-permit-checklist/route";
import { POST as createPlanningSession } from "@/app/api/gus/planning/session/route";
import { isGusAllowedRoute, isGusDisabledRoute } from "@/components/gus/gusConfig";
import { canGusSpeak } from "@/lib/gus/gusVoice";
import { recordGusFeedback, resetGusMemoryForTests, updateGusMemoryPatterns } from "@/lib/gus/gusMemory";
import { selectGusMessage } from "@/lib/gus/gusMessageSelector";
import { applyGusFeedbackScore } from "@/lib/gus/gusScoring";
import { isForbiddenGusAction } from "@/lib/gus/gusTrustRules";
import { validateGusOutput } from "@/lib/gus/gusValidation";
import { buildGusDraftRecord, type GusPlanningSessionRecord } from "@/lib/gus/gusDraftRecordBuilder";
import { detectGusWorkTypes } from "@/lib/gus/plans/detectWorkType";
import { generateSafeWorkPlan } from "@/lib/gus/plans/generateSafeWorkPlan";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOBSITE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const INTERACTION_ID = "44444444-4444-4444-8444-444444444444";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/gus/reliability", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function auth() {
  return {
    supabase: { from: mocks.from },
    user: { id: USER_ID, email: "safety@example.com" },
    role: "company_user",
    team: "Safety",
    accountStatus: "active",
    permissions: ["can_create_documents"],
    permissionMap: { can_create_documents: true },
  };
}

function samplePlanningSession(overrides: Partial<GusPlanningSessionRecord> = {}): GusPlanningSessionRecord {
  return {
    id: "session-1",
    company_id: COMPANY_ID,
    jobsite_id: JOBSITE_ID,
    user_id: USER_ID,
    work_type: "hotWork",
    task_description: "Grinding steel brackets near stored materials",
    status: "draft_incomplete",
    plan_data: {
      sections: [
        { title: "Task Summary", items: ["Grinding steel brackets near stored materials"] },
        { title: "Primary Hazards", items: ["Fire exposure", "Eye and face exposure"] },
        { title: "Required Controls", items: ["Remove combustible materials", "Assign fire watch"] },
        { title: "Required Permits / Reviews", items: ["Hot work permit review may be required"] },
        { title: "Required Training / Qualifications", items: ["Hot work training verification"] },
        { title: "Inspection Requirements", items: ["Inspect fire extinguisher and work area"] },
        { title: "PPE", items: ["Eye and face protection review"] },
        { title: "Stop-Work Triggers", items: ["Combustibles cannot be moved or protected"] },
        { title: "Human Review Required", items: ["Supervisor review required"] },
      ],
    },
    missing_items: ["Fire watch name"],
    risk_flags: ["Combustible storage nearby"],
    human_review_required: true,
    ...overrides,
  };
}

function setupDraftRouteInsert() {
  const insertedRows: unknown[] = [];
  const session = samplePlanningSession();

  mocks.from.mockImplementation((table: string) => {
    if (table === "gus_planning_sessions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: session, error: null })),
          })),
        })),
      };
    }

    if (table === "gus_generated_plans") {
      return {
        insert: vi.fn((row: unknown) => {
          insertedRows.push(row);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: "draft-1", ...(row as Record<string, unknown>) },
                error: null,
              })),
            })),
          };
        }),
      };
    }

    if (table === "user_roles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { user_id: USER_ID }, error: null })),
              })),
            })),
          })),
        })),
      };
    }

    if (table === "company_jobsite_assignments") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "assignment-1" }, error: null })),
              })),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return insertedRows;
}

describe("Gus reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGusMemoryForTests();
    mocks.authorizeRequest.mockResolvedValue(auth());
  });

  it("1. Gus appears on allowed routes", () => {
    expect(isGusAllowedRoute("/dashboard")).toBe(true);
    expect(isGusAllowedRoute("/safe-predict")).toBe(true);
    expect(isGusAllowedRoute("/safe-predict/jobsites")).toBe(true);
    expect(isGusAllowedRoute("/jobsites/alpha")).toBe(true);
    expect(isGusDisabledRoute("/dashboard")).toBe(false);
  });

  it("2. Gus does not appear on disabled routes", () => {
    expect(isGusDisabledRoute("/login")).toBe(true);
    expect(isGusDisabledRoute("/billing")).toBe(true);
    expect(isGusAllowedRoute("/login")).toBe(false);
  });

  it("3. Gus cannot approve records", () => {
    expect(isForbiddenGusAction("approve_permit")).toBe(true);
    const result = validateGusOutput({ actionKey: "approve_permit" });
    expect(result.sanitizedOutput).toMatchObject({ actionKey: "recommend_review" });
  });

  it("4. Gus cannot submit JSAs", () => {
    expect(isForbiddenGusAction("submit_jsa")).toBe(true);
  });

  it("5. Gus cannot close corrective actions", () => {
    expect(isForbiddenGusAction("close_corrective_action")).toBe(true);
  });

  it("6. Gus cannot delete records", () => {
    expect(isForbiddenGusAction("delete_record")).toBe(true);
  });

  it("7. Gus cannot claim OSHA compliant", () => {
    const result = validateGusOutput({
      message: "This plan is OSHA compliant and approved.",
    });
    const message = (result.sanitizedOutput as { message: string }).message;
    expect(message).not.toMatch(/\bcompliant\b/i);
    expect(message).not.toMatch(/\bapproved\b/i);
    expect(result.findings.map((finding) => finding.code)).toContain("unsafe_language");
  });

  it("8. Gus can create draft planning sessions", async () => {
    const insertedRows: unknown[] = [];
    mocks.from.mockImplementation((table: string) => {
      if (table === "user_roles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { user_id: USER_ID }, error: null })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === "company_jobsite_assignments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: "assignment-1" }, error: null })),
                })),
              })),
            })),
          })),
        };
      }

      expect(table).toBe("gus_planning_sessions");
      return {
        insert: vi.fn((row: unknown) => {
          insertedRows.push(row);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: "session-created", ...(row as Record<string, unknown>) },
                error: null,
              })),
            })),
          };
        }),
      };
    });

    const response = (await createPlanningSession(
      request({
        companyId: COMPANY_ID,
        jobsiteId: JOBSITE_ID,
        workType: "hotWork",
        taskDescription: "Grinding steel near stored materials",
        missingItems: ["Fire watch name"],
        riskFlags: ["Combustible storage nearby"],
      }),
    )) as Response;
    const body = (await response.json()) as {
      session: { status: string; human_review_required: boolean; detected_modules: Array<{ id: string }> };
      draftOnly: boolean;
      officialRecordCreated: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.draftOnly).toBe(true);
    expect(body.officialRecordCreated).toBe(false);
    expect(body.session.status).toBe("draft_incomplete");
    expect(body.session.human_review_required).toBe(true);
    expect(body.session.detected_modules.map((match) => match.id)).toContain("hotWork");
    expect(insertedRows).toHaveLength(1);
  });

  it("9. Gus marks plans incomplete when critical information is missing", () => {
    const result = generateSafeWorkPlan({
      taskDescription: "Trenching for conduit",
      selectedModuleIds: ["trenching"],
    });

    expect(result.plan.status).toBe("draft_incomplete");
    expect(result.plan.missingInformation).toEqual(
      expect.arrayContaining(["Work area", "Crew / trades", "Equipment / tools / materials"]),
    );
  });

  it("10. Gus requires human review", () => {
    const result = generateSafeWorkPlan({
      taskDescription: "General pre-task planning",
      workArea: "Level 1",
      crewTrades: "General crew",
      equipmentToolsMaterials: "Hand tools",
      selectedModuleIds: ["generalPreTask"],
    });

    expect(result.plan.humanReviewRequired).toBe(true);
  });

  it("11. Gus can generate draft safe work plan", () => {
    const result = generateSafeWorkPlan({
      taskDescription: "Hot work welding pipe supports",
      workArea: "Mechanical room",
      crewTrades: "Pipefitters",
      equipmentToolsMaterials: "Welder, grinder, extinguisher",
      selectedModuleIds: ["hotWork"],
    });

    expect(result.plan.draftOnly).toBe(true);
    expect(result.plan.officialRecordCreated).toBe(false);
    expect(result.plan.sections.map((section) => section.title)).toContain("Gus Recommendation");
  });

  it("12. Gus can generate draft JSA after confirmation", async () => {
    const insertedRows = setupDraftRouteInsert();
    const response = (await createDraftJsa(request({ sessionId: "session-1", confirmed: true }))) as Response;
    const body = (await response.json()) as { draftCreated: boolean; officialRecordCreated: boolean };

    expect(response.status).toBe(200);
    expect(body.draftCreated).toBe(true);
    expect(body.officialRecordCreated).toBe(false);
    expect(insertedRows[0]).toMatchObject({
      plan_type: "jsa",
      status: "draft_incomplete",
      human_review_required: true,
    });
  });

  it("13. Gus can generate draft permit checklist after confirmation", async () => {
    const insertedRows = setupDraftRouteInsert();
    const response = (await createDraftPermitChecklist(
      request({ sessionId: "session-1", confirmed: true, permitType: "Hot work" }),
    )) as Response;
    const body = (await response.json()) as { draftCreated: boolean; officialRecordCreated: boolean };

    expect(response.status).toBe(200);
    expect(body.draftCreated).toBe(true);
    expect(body.officialRecordCreated).toBe(false);
    expect(insertedRows[0]).toMatchObject({
      plan_type: "permit_checklist",
      status: "draft_incomplete",
      human_review_required: true,
    });
  });

  it("14. Gus voice is opt-in", () => {
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 4 },
        voiceEnabled: false,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
  });

  it("15. Gus can be muted", () => {
    expect(
      canGusSpeak({
        route: "/dashboard",
        message: { category: "safety_tip", priority: 4 },
        voiceEnabled: false,
        textOnlyMode: true,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
  });

  it("16. Gus does not speak on disabled routes", () => {
    expect(
      canGusSpeak({
        route: "/login",
        message: { category: "warning", priority: 1 },
        voiceEnabled: true,
        textOnlyMode: false,
        disabledUntilMs: 0,
        isUserTyping: false,
      }),
    ).toBe(false);
  });

  it("17. Helpful feedback increases score", () => {
    expect(
      applyGusFeedbackScore(0, {
        interactionId: INTERACTION_ID,
        helpful: true,
      }),
    ).toBeGreaterThan(0);
  });

  it("18. Not helpful feedback decreases score", () => {
    expect(
      applyGusFeedbackScore(0, {
        interactionId: INTERACTION_ID,
        helpful: false,
      }),
    ).toBeLessThan(0);
  });

  it("19. Repeated issue creates memory trend", () => {
    const memory = updateGusMemoryPatterns(
      { companyId: COMPANY_ID, jobsiteId: JOBSITE_ID },
      {
        observations: [
          { type: "housekeeping", createdAt: "2026-05-01T12:00:00.000Z" },
          { category: "Housekeeping", createdAt: "2026-05-03T12:00:00.000Z" },
          { type: "poor housekeeping", createdAt: "2026-05-05T12:00:00.000Z" },
        ],
      },
      new Date("2026-05-22T12:00:00.000Z"),
    );

    expect(memory.patterns.map((pattern) => pattern.key)).toContain("housekeeping_trend");
  });

  it("20. Memory does not override safety rules", () => {
    recordGusFeedback(
      { companyId: COMPANY_ID, userId: USER_ID },
      { interactionId: INTERACTION_ID, helpful: true, clicked: true },
    );

    const message = selectGusMessage({
      companyId: COMPANY_ID,
      jobsiteId: JOBSITE_ID,
      userId: USER_ID,
      currentPage: "Risk",
      route: "/risk",
      liveContext: {
        riskLevel: "severe",
        riskDrivers: ["Open corrective action and severe risk driver"],
      },
    });

    expect(message.messageId).toBe("gus-critical-risk-warning");
    expect(message.category).toBe("warning");
    expect(message.message).toMatch(/human safety review/i);
    expect(message.message).not.toMatch(/\bapproved\b|\bcompliant\b|\bsafe\s+to\s+start\b/i);
  });

  it("21. Auto-detection detects hot work", () => {
    expect(detectGusWorkTypes("welding pipe supports").matches.map((match) => match.id)).toContain("hotWork");
  });

  it("22. Auto-detection detects LOTO", () => {
    expect(detectGusWorkTypes("service a pump with stored energy").matches.map((match) => match.id)).toContain("loto");
  });

  it("23. Auto-detection detects work at height", () => {
    expect(detectGusWorkTypes("install ductwork overhead from a lift").matches.map((match) => match.id)).toContain(
      "workAtHeight",
    );
  });

  it("24. Auto-detection detects trenching", () => {
    expect(detectGusWorkTypes("excavate trench for underground conduit").matches.map((match) => match.id)).toContain(
      "trenching",
    );
  });

  it("25. Auto-detection supports multiple modules", () => {
    const ids = detectGusWorkTypes("welding from a lift near stored materials").matches.map((match) => match.id);

    expect(ids).toContain("hotWork");
    expect(ids).toContain("workAtHeight");
    expect(ids).toContain("mewp");
    expect(ids).toContain("housekeeping");
  });

  it("keeps draft record builder outputs draft-only and review-required", () => {
    const jsa = buildGusDraftRecord(samplePlanningSession(), "jsa");

    expect(jsa.content.draftOnly).toBe(true);
    expect(jsa.content.humanReviewRequired).toBe(true);
    expect(jsa.content.officialRecordCreated).toBe(false);
    expect(jsa.content.status).toBe("draft_incomplete");
  });
});

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

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/gus/planning/draft", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function auth() {
  return {
    supabase: { from: mocks.from },
    user: { id: "user-1", email: "safety@example.com" },
    role: "company_user",
    team: "Safety",
    accountStatus: "active",
    permissions: ["can_create_documents"],
    permissionMap: { can_create_documents: true },
  };
}

function setupConfirmedInsert() {
  const insertedRows: unknown[] = [];
  const session = {
    id: "session-1",
    company_id: null,
    jobsite_id: null,
    user_id: "user-1",
    work_type: "hotWork",
    task_description: "Grinding steel brackets",
    status: "draft_incomplete",
    plan_data: {
      sections: [
        { title: "Task Summary", items: ["Grinding steel brackets"] },
        { title: "Primary Hazards", items: ["Fire exposure"] },
        { title: "Required Controls", items: ["Remove combustible materials"] },
        { title: "Required Permits / Reviews", items: ["Hot work permit review may be required"] },
        { title: "Human Review Required", items: ["Supervisor review required"] },
      ],
    },
    missing_items: ["Fire watch name"],
    risk_flags: ["Combustible storage nearby"],
    human_review_required: true,
  };

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
              single: vi.fn(async () => ({ data: { id: "draft-1", ...(row as Record<string, unknown>) }, error: null })),
            })),
          };
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return insertedRows;
}

describe("Gus draft record routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue(auth());
  });

  it("does not create a draft JSA without explicit confirmation", async () => {
    const response = (await createDraftJsa(request({ sessionId: "session-1", confirmed: false }))) as Response;
    const body = (await response.json()) as { draftCreated?: boolean };

    expect(response.status).toBe(400);
    expect(body.draftCreated).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates a draft JSA only after confirmation", async () => {
    const insertedRows = setupConfirmedInsert();
    const response = (await createDraftJsa(request({ sessionId: "session-1", confirmed: true }))) as Response;
    const body = (await response.json()) as { draftCreated?: boolean; officialRecordCreated?: boolean };

    expect(response.status).toBe(200);
    expect(body.draftCreated).toBe(true);
    expect(body.officialRecordCreated).toBe(false);
    expect(insertedRows).toHaveLength(1);
    expect(mocks.from).not.toHaveBeenCalledWith("company_jsas");
    expect(mocks.from).not.toHaveBeenCalledWith("company_permits");
    expect(insertedRows[0]).toMatchObject({
      session_id: "session-1",
      plan_type: "jsa",
      status: "draft_incomplete",
      human_review_required: true,
      created_by: "user-1",
    });
  });

  it("does not create a draft permit checklist without explicit confirmation", async () => {
    const response = (await createDraftPermitChecklist(request({ sessionId: "session-1" }))) as Response;
    const body = (await response.json()) as { draftCreated?: boolean };

    expect(response.status).toBe(400);
    expect(body.draftCreated).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates a draft permit checklist only after confirmation", async () => {
    const insertedRows = setupConfirmedInsert();
    const response = (await createDraftPermitChecklist(
      request({ sessionId: "session-1", confirmed: true, permitType: "Hot work" }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(insertedRows).toHaveLength(1);
    expect(mocks.from).not.toHaveBeenCalledWith("company_jsas");
    expect(mocks.from).not.toHaveBeenCalledWith("company_permits");
    expect(insertedRows[0]).toMatchObject({
      session_id: "session-1",
      plan_type: "permit_checklist",
      status: "draft_incomplete",
      human_review_required: true,
      created_by: "user-1",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMicrosoftOAuthState,
  decryptMicrosoftToken,
  encryptMicrosoftToken,
  getMicrosoftProjectEnvStatus,
  normalizeDataverseEnvironmentUrl,
  normalizeDataverseProjects,
  normalizeDataverseTasks,
  normalizeMicrosoftSourceId,
  verifyMicrosoftOAuthState,
} from "@/lib/microsoftProject";

describe("microsoftProject connector helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("MICROSOFT_CLIENT_ID", "client-id");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "client-secret");
    vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://app.example.com/api/company/integrations/microsoft-project/callback");
    vi.stubEnv("MICROSOFT_TOKEN_ENCRYPTION_KEY", "test-token-key-with-enough-entropy-for-aes");
  });

  it("reports missing Microsoft connector configuration", () => {
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "");

    expect(getMicrosoftProjectEnvStatus()).toMatchObject({
      clientId: true,
      clientSecret: false,
      configured: false,
    });
  });

  it("round-trips encrypted tokens without storing plaintext", () => {
    const encrypted = encryptMicrosoftToken("refresh-token-value");

    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptMicrosoftToken(encrypted)).toBe("refresh-token-value");
  });

  it("signs and verifies OAuth state", () => {
    const state = createMicrosoftOAuthState({
      companyId: "company-1",
      userId: "user-1",
      dataverseEnvironmentUrl: "https://tenant.crm.dynamics.com/",
    });

    expect(verifyMicrosoftOAuthState(state)).toMatchObject({
      companyId: "company-1",
      userId: "user-1",
      dataverseEnvironmentUrl: "https://tenant.crm.dynamics.com",
    });
    expect(() => verifyMicrosoftOAuthState(`${state}tampered`)).toThrow();
  });

  it("normalizes source ids and Dataverse URLs", () => {
    expect(normalizeMicrosoftSourceId("dataverse_project", "ABC-123 ")).toBe("dataverse_project:abc-123");
    expect(normalizeDataverseEnvironmentUrl("https://tenant.crm.dynamics.com/")).toBe(
      "https://tenant.crm.dynamics.com"
    );
    expect(normalizeDataverseEnvironmentUrl("http://tenant.crm.dynamics.com")).toBeNull();
  });

  it("normalizes Dataverse projects and tasks with missing optional fields", () => {
    const projects = normalizeDataverseProjects([
      {
        msdyn_projectid: "PROJECT-1",
        msdyn_subject: "Hospital Expansion",
        msdyn_projectnumber: "P-100",
        msdyn_scheduledstart: "2026-05-10T00:00:00Z",
        msdyn_finish: "2026-06-10T00:00:00Z",
      },
      { msdyn_projectid: "missing-name" },
    ]);
    const tasks = normalizeDataverseTasks([
      {
        msdyn_projecttaskid: "TASK-1",
        msdyn_subject: "Install guardrails",
        _msdyn_project_value: "PROJECT-1",
        msdyn_percentcomplete: 50,
      },
      { msdyn_projecttaskid: "missing-title" },
    ]);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      sourceProjectId: "dataverse_project:project-1",
      name: "Hospital Expansion",
      projectNumber: "P-100",
      startDate: "2026-05-10",
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      sourceProjectId: "dataverse_project:project-1",
      sourceTaskId: "dataverse_task:task-1",
      status: "in_progress",
    });
  });
});

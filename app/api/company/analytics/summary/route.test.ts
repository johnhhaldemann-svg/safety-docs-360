import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
  isAdminRole: () => false,
}));

import { GET } from "./route";
import { authorizeRequest } from "@/lib/rbac";

describe("/api/company/analytics/summary health issues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "sales_demo",
      team: "Demo",
      user: { id: "demo-user-1" },
      supabase: {},
    } as never);
  });

  it("returns rollup and no focus without injuryType", async () => {
    const res = await GET(new Request("http://localhost/api/company/analytics/summary?days=30"));
    expect(res).toBeDefined();
    if (!res) throw new Error("Missing response");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.healthIssueRollup.length).toBeGreaterThan(0);
    expect(body.summary.healthIssueFocus).toBeNull();
  });

  it("returns focused health issue when injuryType is provided", async () => {
    const res = await GET(
      new Request("http://localhost/api/company/analytics/summary?days=30&injuryType=contusion")
    );
    expect(res).toBeDefined();
    if (!res) throw new Error("Missing response");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.healthIssueFocus).toBeTruthy();
    expect(body.summary.healthIssueFocus.injuryType).toBe("contusion");
  });
});

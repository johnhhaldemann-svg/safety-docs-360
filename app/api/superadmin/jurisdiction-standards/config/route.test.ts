import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_JURISDICTION_STANDARDS_CONFIG } from "@/lib/jurisdictionStandards/catalog";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/jurisdictionStandards/settings", () => ({
  getJurisdictionStandardsConfig: vi.fn(),
  saveJurisdictionStandardsConfig: vi.fn(),
}));

import { GET, PATCH } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import {
  getJurisdictionStandardsConfig,
  saveJurisdictionStandardsConfig,
} from "@/lib/jurisdictionStandards/settings";

describe("/api/superadmin/jurisdiction-standards/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-super-admin users", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "admin",
      supabase: {},
      user: { id: "user-1" },
    } as never);

    const response = await GET(
      new Request("http://localhost/api/superadmin/jurisdiction-standards/config")
    );
    if (!response) {
      throw new Error("Expected GET to return a response");
    }
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Super admin access required");
  });

  it("returns the saved config for super admins", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "super_admin",
      supabase: {},
      user: { id: "user-1" },
    } as never);
    vi.mocked(getJurisdictionStandardsConfig).mockResolvedValue(
      DEFAULT_JURISDICTION_STANDARDS_CONFIG as never
    );

    const response = await GET(
      new Request("http://localhost/api/superadmin/jurisdiction-standards/config")
    );
    if (!response) {
      throw new Error("Expected GET to return a response");
    }
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jurisdictions[0].code).toBe("federal");
    expect(data.standards.some((standard: { id: string }) => standard.id === "std_ca_iipp_review")).toBe(
      true
    );
  });

  it("persists normalized config for super admins", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "super_admin",
      supabase: {},
      user: { id: "user-1" },
    } as never);
    vi.mocked(saveJurisdictionStandardsConfig).mockResolvedValue({
      data: DEFAULT_JURISDICTION_STANDARDS_CONFIG,
      error: null,
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/superadmin/jurisdiction-standards/config", {
        method: "PATCH",
        body: JSON.stringify(DEFAULT_JURISDICTION_STANDARDS_CONFIG),
      })
    );
    if (!response) {
      throw new Error("Expected PATCH to return a response");
    }
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mappings.some((mapping: { id: string }) => mapping.id === "map_wa_profile")).toBe(
      true
    );
  });
});

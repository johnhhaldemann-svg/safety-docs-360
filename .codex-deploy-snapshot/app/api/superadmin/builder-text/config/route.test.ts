import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG } from "@/lib/documentBuilderText";

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/documentBuilderTextSettings", () => ({
  getDocumentBuilderTextConfig: vi.fn(),
  saveDocumentBuilderTextConfig: vi.fn(),
}));

import { GET, PATCH } from "./route";
import { authorizeRequest } from "@/lib/rbac";
import {
  getDocumentBuilderTextConfig,
  saveDocumentBuilderTextConfig,
} from "@/lib/documentBuilderTextSettings";

describe("/api/superadmin/builder-text/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-super-admin users", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "admin",
      supabase: {},
      user: { id: "user-1" },
    } as never);

    const response = await GET(new Request("http://localhost/api/superadmin/builder-text/config"));
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
    vi.mocked(getDocumentBuilderTextConfig).mockResolvedValue(
      DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG as never
    );

    const response = await GET(new Request("http://localhost/api/superadmin/builder-text/config"));
    if (!response) {
      throw new Error("Expected GET to return a response");
    }
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.builders.csep.sections[0].key).toBe("scope_of_work");
  });

  it("persists normalized config for super admins", async () => {
    vi.mocked(authorizeRequest).mockResolvedValue({
      role: "super_admin",
      supabase: {},
      user: { id: "user-1" },
    } as never);
    vi.mocked(saveDocumentBuilderTextConfig).mockResolvedValue({
      data: DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
      error: null,
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/superadmin/builder-text/config", {
        method: "PATCH",
        body: JSON.stringify(DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG),
      })
    );
    if (!response) {
      throw new Error("Expected PATCH to return a response");
    }
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.builders.site_builder.sections[0].key).toBe("cover_document_purpose");
  });
});

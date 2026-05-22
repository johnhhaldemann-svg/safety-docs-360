import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest: mocks.authorizeRequest,
}));

import { POST } from "@/app/api/gus/speech/route";

function speechRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/gus/speech", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Gus speech API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRequest.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
      role: "company_user",
      team: "Safety",
      accountStatus: "active",
      permissions: [],
      permissionMap: {},
    });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  it("keeps OPENAI_API_KEY server-side and returns audio", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { input: string; voice: string; response_format: string };

      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      });
      expect(body.input).toBe("Heads up. Review permits.");
      expect(body.voice).toBe("marin");
      expect(body.response_format).toBe("mp3");

      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = (await POST(
      speechRequest({
        text: "**Heads up.** Review [permits](https://example.com).",
        voice: "marin",
        speed: 1,
        format: "mp3",
      }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(response.headers)).not.toContain("test-key");
  });

  it("returns a safe error when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = (await POST(speechRequest({ text: "Hello", voice: "marin", speed: 1, format: "mp3" }))) as Response;
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("OPENAI_API_KEY");
  });
});

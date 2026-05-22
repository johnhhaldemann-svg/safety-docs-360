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
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("OPENAI_TTS_API_KEY", "");
    vi.stubEnv("OPENAI_TTS_BASE_URL", "");
    vi.stubEnv("OPENAI_TTS_MODEL", "");
  });

  it("keeps OPENAI_API_KEY server-side and returns audio", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        input: string;
        voice: string;
        response_format: string;
        speed: number;
        instructions: string;
      };

      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      });
      expect(body.input).toBe("Heads up. Review permits.");
      expect(body.voice).toBe("marin");
      expect(body.response_format).toBe("mp3");
      expect(body.speed).toBe(1);
      expect(body.instructions).toContain("deep, metallic");
      expect(body.instructions).not.toMatch(/terminator|arnold|schwarzenegger/i);

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
        style: "cyborg_coach",
      }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(response.headers)).not.toContain("test-key");
  });

  it("uses the cyborg coach voice preset by default", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        voice: string;
        speed: number;
        instructions: string;
      };

      expect(body.voice).toBe("onyx");
      expect(body.speed).toBe(0.88);
      expect(body.instructions).toContain("deep, metallic");
      expect(body.instructions).toContain("authoritative");
      expect(body.instructions).not.toMatch(/terminator|arnold|schwarzenegger/i);

      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = (await POST(speechRequest({ text: "Review the high-risk task first." }))) as Response;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a safe error when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = (await POST(speechRequest({ text: "Hello", voice: "marin", speed: 1, format: "mp3" }))) as Response;
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("OPENAI_API_KEY");
  });

  it("does not send speech requests to Vercel AI Gateway", async () => {
    vi.stubEnv("OPENAI_API_KEY", "vck_test_gateway_key");
    vi.stubEnv("OPENAI_BASE_URL", "https://ai-gateway.vercel.sh/v1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = (await POST(speechRequest({ text: "Hello", voice: "marin", speed: 1, format: "mp3" }))) as Response;
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("OPENAI_TTS_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a dedicated OpenAI speech key when chat uses AI Gateway", async () => {
    vi.stubEnv("OPENAI_API_KEY", "vck_test_gateway_key");
    vi.stubEnv("OPENAI_BASE_URL", "https://ai-gateway.vercel.sh/v1");
    vi.stubEnv("OPENAI_TTS_API_KEY", "sk-test-tts");

    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/audio/speech");
      expect(init.headers).toMatchObject({
        Authorization: "Bearer sk-test-tts",
      });

      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = (await POST(speechRequest({ text: "Hello", voice: "marin", speed: 1, format: "mp3" }))) as Response;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

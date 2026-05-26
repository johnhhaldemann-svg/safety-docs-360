import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ authorizeRequest: mocks.authorizeRequest }));

import { GET, PATCH } from "@/app/api/gus/notification-settings/route";

function request(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/gus/notification-settings", {
    method: body ? "PATCH" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function supabaseProfileStore(initialSettings: unknown = null) {
  let savedSettings = initialSettings;

  return {
    get savedSettings() {
      return savedSettings;
    },
    from: vi.fn(() => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() =>
          Promise.resolve({
            data: savedSettings === null ? null : { gus_notification_settings: savedSettings },
            error: null,
          }),
        ),
        upsert: vi.fn((row: { gus_notification_settings?: unknown }) => {
          savedSettings = row.gus_notification_settings;
          return builder;
        }),
      };
      return builder;
    }),
  };
}

describe("Gus notification settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default settings when the profile row has no saved value", async () => {
    mocks.authorizeRequest.mockResolvedValue({
      supabase: supabaseProfileStore(null),
      user: { id: "user-1" },
    });

    const response = (await GET(request())) as Response;
    const body = (await response.json()) as { settings: { emailEnabled: boolean; voiceEnabled: boolean } };

    expect(response.status).toBe(200);
    expect(body.settings.emailEnabled).toBe(true);
    expect(body.settings.voiceEnabled).toBe(false);
  });

  it("merges partial patches and keeps voice/text-only exclusive", async () => {
    const supabase = supabaseProfileStore({ textOnlyMode: true, voiceEnabled: false });
    mocks.authorizeRequest.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
    });

    const response = (await PATCH(request({ settings: { voiceEnabled: true } }))) as Response;
    const body = (await response.json()) as { settings: { voiceEnabled: boolean; textOnlyMode: boolean } };

    expect(response.status).toBe(200);
    expect(body.settings).toMatchObject({
      voiceEnabled: true,
      textOnlyMode: false,
    });
    expect(supabase.savedSettings).toMatchObject({
      voiceEnabled: true,
      textOnlyMode: false,
    });
  });
});

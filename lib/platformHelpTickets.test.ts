import { describe, expect, it } from "vitest";
import {
  normalizePlatformHelpTicketRow,
  summarizePlatformHelpTickets,
  validatePlatformHelpTicketCreate,
  validatePlatformHelpTicketUpdate,
} from "./platformHelpTickets";

describe("platformHelpTickets", () => {
  it("validates and normalizes ticket creation input", () => {
    const valid = validatePlatformHelpTicketCreate({
      category: "bug",
      priority: "high",
      title: "Preview failed",
      description: "The CSEP preview failed after I clicked generate.",
      pageUrl: "https://example.com/csep",
      browserUserAgent: "Vitest",
      metadata: { timezone: "America/Chicago" },
    });

    expect(valid).toMatchObject({
      ok: true,
      value: {
        category: "bug",
        priority: "high",
        title: "Preview failed",
      },
    });
  });

  it("rejects unsupported create and update values", () => {
    expect(
      validatePlatformHelpTicketCreate({
        category: "safety_incident",
        priority: "urgent",
        title: "Bad",
        description: "Too short",
      })
    ).toMatchObject({ ok: false });

    expect(validatePlatformHelpTicketUpdate({ status: "deleted" })).toMatchObject({
      ok: false,
    });
  });

  it("builds queue summary counts from normalized rows", () => {
    const tickets = [
      normalizePlatformHelpTicketRow({
        id: "1",
        submitter_user_id: "u1",
        category: "bug",
        priority: "critical",
        status: "open",
        title: "A",
        description: "B",
        superadmin_seen_at: null,
      }),
      normalizePlatformHelpTicketRow({
        id: "2",
        submitter_user_id: "u2",
        category: "billing",
        priority: "high",
        status: "in_progress",
        title: "C",
        description: "D",
        superadmin_seen_at: "2026-05-26T00:00:00.000Z",
      }),
      normalizePlatformHelpTicketRow({
        id: "3",
        submitter_user_id: "u3",
        category: "other",
        priority: "normal",
        status: "closed",
        title: "E",
        description: "F",
      }),
    ];

    expect(summarizePlatformHelpTickets(tickets)).toMatchObject({
      total: 3,
      open: 1,
      inProgress: 1,
      closed: 1,
      unseen: 1,
      critical: 1,
      high: 1,
    });
  });
});


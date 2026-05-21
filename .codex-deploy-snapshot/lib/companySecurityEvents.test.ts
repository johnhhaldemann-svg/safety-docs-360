import { describe, expect, it, vi } from "vitest";
import {
  isMissingCompanySecurityEventsError,
  recordCompanySecurityEvent,
} from "@/lib/companySecurityEvents";

describe("recordCompanySecurityEvent", () => {
  it("skips when no company id is available", async () => {
    const from = vi.fn();

    const result = await recordCompanySecurityEvent({
      supabase: { from },
      companyId: null,
      eventType: "user_invited",
      resourceType: "company_invite",
    });

    expect(result).toEqual({ skipped: true, error: null });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts a normalized company security event", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));

    const result = await recordCompanySecurityEvent({
      supabase: { from },
      companyId: "company-1",
      actorUserId: "user-1",
      actorRole: "company_admin",
      eventType: "user_invited",
      resourceType: "company_invite",
      resourceId: "invite-1",
      metadata: { email: "worker@example.com" },
    });

    expect(result).toEqual({ skipped: false, error: null });
    expect(from).toHaveBeenCalledWith("company_security_events");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      company_id: "company-1",
      actor_user_id: "user-1",
      event_type: "user_invited",
      resource_type: "company_invite",
      title: "Company invite created",
      metadata: { email: "worker@example.com" },
    }));
  });

  it("treats missing migration errors as skipped", async () => {
    expect(isMissingCompanySecurityEventsError({
      message: 'relation "company_security_events" does not exist',
    })).toBe(true);
  });
});

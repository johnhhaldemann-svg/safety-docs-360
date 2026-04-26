import { describe, expect, it } from "vitest";
import {
  getOrphanCompanyWorkspaceNav,
  getWorkspaceNavItemMeta,
  groupCompanyWorkspaceSections,
} from "@/lib/workspaceNavigationModel";

describe("workspaceNavigationModel", () => {
  it("maps common company routes into stable workflow groups", () => {
    const grouped = groupCompanyWorkspaceSections([
      {
        title: "Mixed",
        items: [
          { href: "/dashboard", label: "Dashboard", short: "DB" },
          { href: "/command-center", label: "Command Center", short: "CC" },
          { href: "/library", label: "Documents", short: "DC" },
          { href: "/jobsites", label: "Jobsites", short: "JS" },
          { href: "/reports", label: "Reports", short: "RP" },
        ],
      },
    ]);

    expect(grouped.map((section) => section.group)).toEqual(["today", "fieldSites", "insights"]);
    expect(grouped.some((s) => s.group === "programs")).toBe(false);
    expect(grouped[0]?.items.map((item) => item.href)).toEqual(["/dashboard", "/command-center"]);
    expect(grouped.find((s) => s.group === "insights")?.description).toContain("library");
  });

  it("adds item-level descriptions and CTA copy for operator surfaces", () => {
    expect(
      getWorkspaceNavItemMeta({
        href: "/training-matrix",
        label: "Training",
        short: "TR",
      })
    ).toMatchObject({
      group: "programs",
      primaryActionLabel: "Review gaps",
    });

    expect(
      getWorkspaceNavItemMeta({
        href: "/library",
        label: "Documents",
        short: "DC",
      }).description
    ).toContain("finished records");
  });

  it("preserves section and item descriptions for grouped workspace navigation", () => {
    const grouped = groupCompanyWorkspaceSections([
      {
        title: "Mixed",
        items: [
          { href: "/command-center", label: "Command Center", short: "CC" },
          { href: "/library", label: "Documents", short: "DC" },
          { href: "/jobsites", label: "Jobsites", short: "JS" },
          { href: "/profile", label: "Profile", short: "PF" },
        ],
      },
    ]);

    expect(grouped.map((section) => `${section.title}:${section.description}`)).toEqual([
      "Today:Dashboard, command hub, and submission inbox for daily work.",
      "Field & Sites:Job sites, JSAs, permits, incidents, and field issue tracking.",
      "Insights:Analytics, workflow activity, reports, library, and search.",
      "Account:Billing, team access, profile, purchases, and marketplace previews.",
    ]);
    expect(grouped[0]?.items[0]).toMatchObject({
      href: "/command-center",
      description: "Current risk, open work, and recommended next steps.",
    });
    expect(grouped[3]?.items[0]).toMatchObject({
      href: "/profile",
      description: "Update your account profile, contact details, role context, and personal settings.",
    });
  });

  it("assigns route-specific admin descriptions instead of one generic workspace blurb", () => {
    expect(
      getWorkspaceNavItemMeta({
        href: "/billing",
        label: "Billing",
        short: "BL",
      })
    ).toMatchObject({
      group: "account",
      description: "Review billing activity, invoices, payment status, and account charges.",
      primaryActionLabel: "Open billing",
    });

    expect(
      getWorkspaceNavItemMeta({
        href: "/company-users",
        label: "Team",
        short: "TM",
      })
    ).toMatchObject({
      group: "account",
      description: "Manage team members, contractors, invitations, access roles, and permissions.",
      primaryActionLabel: "Open team",
    });

    expect(
      getWorkspaceNavItemMeta({
        href: "/settings/risk-memory",
        label: "Risk Memory setup",
        short: "RM",
      })
    ).toMatchObject({
      group: "fieldSites",
      description:
        "Manage contractor and crew lists used on incidents, field issues, and Risk Memory rollups.",
      primaryActionLabel: "Open setup",
    });
  });

  it("exposes orphan company routes for shell header when omitted from sidebar nav", () => {
    expect(getOrphanCompanyWorkspaceNav("/settings/risk-memory")).toMatchObject({
      item: { href: "/settings/risk-memory", label: "Risk Memory setup", short: "RM" },
      sectionTitle: "Field & Sites",
      sectionKey: "orphan-fieldSites",
    });
    expect(getOrphanCompanyWorkspaceNav("/incidents")).toBeNull();
  });

  it("places safety intelligence under programs and portfolio analytics under insights", () => {
    expect(
      getWorkspaceNavItemMeta({ href: "/safety-intelligence", label: "SI", short: "SI" })
    ).toMatchObject({ group: "programs" });
    expect(getWorkspaceNavItemMeta({ href: "/analytics", label: "RT", short: "AN" })).toMatchObject({
      group: "insights",
    });
    expect(
      getWorkspaceNavItemMeta({
        href: "/analytics/safety-intelligence",
        label: "SA",
        short: "SA",
      })
    ).toMatchObject({ group: "insights" });

    const grouped = groupCompanyWorkspaceSections([
      {
        title: "Insights",
        items: [
          { href: "/safety-intelligence", label: "Safety Intelligence", short: "SI" },
          { href: "/analytics", label: "Safety analytics", short: "AN" },
          { href: "/dashboard", label: "Home", short: "HM" },
        ],
      },
    ]);

    expect(grouped.map((s) => s.group)).toEqual(["today", "programs", "insights"]);
    const insights = grouped.find((s) => s.group === "insights");
    expect(insights?.title).toBe("Insights");
    expect(insights?.items.map((i) => i.href)).toEqual(["/analytics"]);
    const programs = grouped.find((s) => s.group === "programs");
    expect(programs?.items.map((i) => i.href)).toEqual(["/safety-intelligence"]);
  });
});

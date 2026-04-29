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
          { href: "/field-audits", label: "Audits", short: "FA" },
          { href: "/jobsites", label: "Jobsites", short: "JS" },
          { href: "/reports", label: "Reports", short: "RP" },
        ],
      },
    ]);

    expect(grouped.map((section) => section.group)).toEqual([
      "today",
      "audits",
      "documents",
      "fieldSites",
      "insights",
    ]);
    expect(grouped.some((s) => s.group === "programs")).toBe(false);
    expect(grouped[0]?.items.map((item) => item.href)).toEqual(["/dashboard", "/command-center"]);
    expect(grouped.find((s) => s.group === "audits")?.items.map((item) => item.href)).toEqual([
      "/field-audits",
    ]);
    expect(grouped.find((s) => s.group === "documents")?.items.map((item) => item.href)).toEqual([
      "/library",
    ]);
    expect(grouped.find((s) => s.group === "insights")?.description).toContain("reports");
  });

  it("adds item-level descriptions and CTA copy for operator surfaces", () => {
    expect(
      getWorkspaceNavItemMeta({
        href: "/audit-customers",
        label: "Audit Customers",
        short: "AC",
      })
    ).toMatchObject({
      group: "audits",
      description: "Manage audit customers, report contacts, and linked audit jobsites.",
      primaryActionLabel: "Open customers",
    });

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
      })
    ).toMatchObject({
      group: "documents",
      description: "Browse finished records, templates, and marketplace content.",
      primaryActionLabel: "Open documents",
    });

    expect(
      getWorkspaceNavItemMeta({
        href: "/csep",
        label: "Contractor Safety Plan",
        short: "DC",
      })
    ).toMatchObject({
      group: "documents",
      primaryActionLabel: "Build document",
    });
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
      "Documents:Library, templates, uploads, submissions, search, and safety plan builders.",
      "Field & Sites:Job sites, JSAs, permits, incidents, and field issue tracking.",
      "Account:Billing, team access, profile, and purchases.",
    ]);
    expect(grouped[0]?.items[0]).toMatchObject({
      href: "/command-center",
      description: "Current risk, open work, and recommended next steps.",
    });
    expect(grouped[1]?.items[0]).toMatchObject({
      href: "/library",
      description: "Browse finished records, templates, and marketplace content.",
    });
    expect(grouped[3]?.items[0]).toMatchObject({
      href: "/profile",
      description: "Update your account profile, contact details, role context, and personal settings.",
    });
  });

  it("keeps document workflows together when grouping company navigation", () => {
    const grouped = groupCompanyWorkspaceSections([
      {
        title: "Mixed",
        items: [
          { href: "/submit", label: "Submit", short: "SB" },
          { href: "/upload", label: "Upload", short: "UP" },
          { href: "/search", label: "Search", short: "SR" },
          { href: "/marketplace-preview-approvals", label: "Preview Requests", short: "PA" },
          { href: "/peshep", label: "Site plan", short: "DS" },
          { href: "/csep", label: "Contractor plan", short: "DC" },
        ],
      },
    ]);

    expect(grouped.map((section) => `${section.title}:${section.description}`)).toEqual([
      "Documents:Library, templates, uploads, submissions, search, and safety plan builders.",
    ]);
    expect(grouped[0]?.items.map((item) => item.href)).toEqual([
      "/submit",
      "/upload",
      "/search",
      "/marketplace-preview-approvals",
      "/peshep",
      "/csep",
    ]);
  });

  it("preserves account descriptions for grouped workspace navigation", () => {
    const grouped = groupCompanyWorkspaceSections([
      {
        title: "Mixed",
        items: [
          { href: "/profile", label: "Profile", short: "PF" },
        ],
      },
    ]);

    expect(grouped.map((section) => `${section.title}:${section.description}`)).toEqual([
      "Account:Billing, team access, profile, and purchases.",
    ]);
    expect(grouped[0]?.items[0]).toMatchObject({
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

import { describe, expect, it } from "vitest";
import {
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

    expect(grouped.map((section) => section.group)).toEqual([
      "operations",
      "documents",
      "jobsites",
      "admin",
    ]);
    expect(grouped[0]?.items.map((item) => item.href)).toEqual([
      "/dashboard",
      "/command-center",
    ]);
    expect(grouped[1]?.description).toContain("library");
  });

  it("adds item-level descriptions and CTA copy for operator surfaces", () => {
    expect(
      getWorkspaceNavItemMeta({
        href: "/training-matrix",
        label: "Training",
        short: "TR",
      })
    ).toMatchObject({
      group: "operations",
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
      "Operations:Run daily safety work, triage risk, and keep approvals moving.",
      "Documents:Open records, search the library, and move submissions forward.",
      "Job Sites:Open live jobsites and jump into project-scoped workspaces.",
      "Account & reports:Open billing, team access, reports, and account settings.",
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
      group: "admin",
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
      group: "admin",
      description: "Manage team members, invitations, access roles, and company user permissions.",
      primaryActionLabel: "Open team",
    });

    expect(
      getWorkspaceNavItemMeta({
        href: "/settings/risk-memory",
        label: "Risk Memory setup",
        short: "RM",
      })
    ).toMatchObject({
      group: "admin",
      description: "Tune Risk Memory rules, recommendations, and company knowledge settings.",
      primaryActionLabel: "Open settings",
    });
  });
});

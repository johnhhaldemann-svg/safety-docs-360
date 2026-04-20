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
});

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountSetupQuickLinks,
  accountSetupSideSections,
  adminQuickLinks,
  adminSideSections,
  collectAllAppNavItems,
  companyAdminQuickLinks,
  companyAdminSideSections,
  companyManagerQuickLinks,
  companyManagerSideSections,
  companyUserQuickLinks,
  companyUserSideSections,
  getDeclaredAppNavHrefs,
  internalAdminAppendedSection,
  superadminOnlySideSections,
  userQuickLinks,
  userSideSections,
} from "./appNavigation";
import { resolveHrefToPageFile } from "./internalLinkResolve";

const REPO_ROOT = join(import.meta.dirname, "..");

describe("App Navigation Integrity", () => {
  it("every declared nav href maps to an existing page.tsx", () => {
    const hrefs = getDeclaredAppNavHrefs();
    expect(hrefs.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const href of hrefs) {
      const resolved = resolveHrefToPageFile(REPO_ROOT, href);
      if (!resolved) {
        failures.push(href);
      }
    }

    expect(failures, `Broken nav href(s) — add a page or fix lib/appNavigation.ts:\n${failures.join("\n")}`).toEqual(
      []
    );
  });

  it("nav items have non-empty href, label, and short", () => {
    for (const item of collectAllAppNavItems()) {
      expect(item.href.trim(), `href for "${item.label}"`).toBe(item.href);
      expect(item.href.startsWith("/"), `href must start with /: ${item.href}`).toBe(true);
      expect(item.label.trim().length, `label for ${item.href}`).toBeGreaterThan(0);
      expect(item.short.trim().length, `short for ${item.href}`).toBeGreaterThan(0);
    }
  });

  it("no duplicate hrefs within a single nav section", () => {
    const allSectionGroups: { group: string; sections: { title: string; items: { href: string }[] }[] }[] = [
      { group: "userSideSections", sections: userSideSections },
      { group: "adminSideSections", sections: adminSideSections },
      { group: "superadminOnlySideSections", sections: superadminOnlySideSections },
      { group: "companyAdminSideSections", sections: companyAdminSideSections },
      { group: "companyManagerSideSections", sections: companyManagerSideSections },
      { group: "companyUserSideSections", sections: companyUserSideSections },
      { group: "accountSetupSideSections", sections: accountSetupSideSections },
      { group: "internalAdminAppendedSection", sections: [internalAdminAppendedSection] },
    ];

    for (const { group, sections } of allSectionGroups) {
      for (const section of sections) {
        const hrefs = section.items.map((i) => i.href);
        const unique = new Set(hrefs);
        expect(
          unique.size,
          `${group} → "${section.title}": duplicate href(s) in the same section`
        ).toBe(hrefs.length);
      }
    }
  });

  it("keeps AI Engine Operations in the superadmin-only navigation section", () => {
    const aiEngineHref = "/superadmin/ai-engine";
    const ordinaryAdminHrefs = adminSideSections.flatMap((section) =>
      section.items.map((item) => item.href)
    );
    const companyHrefs = [
      ...companyAdminSideSections,
      ...companyManagerSideSections,
      ...companyUserSideSections,
    ].flatMap((section) => section.items.map((item) => item.href));
    const superadminHrefs = superadminOnlySideSections.flatMap((section) =>
      section.items.map((item) => item.href)
    );

    expect(superadminHrefs).toContain(aiEngineHref);
    expect(ordinaryAdminHrefs).not.toContain(aiEngineHref);
    expect(companyHrefs).not.toContain(aiEngineHref);
  });

  it("exposes the Superadmin hub and CSEP program settings only in superadmin navigation", () => {
    const superadminHrefs = superadminOnlySideSections.flatMap((section) =>
      section.items.map((item) => item.href)
    );
    const ordinaryAdminHrefs = adminSideSections.flatMap((section) =>
      section.items.map((item) => item.href)
    );

    expect(superadminHrefs).toContain("/superadmin");
    expect(superadminHrefs).toContain("/superadmin/cyber-security");
    expect(superadminHrefs).toContain("/superadmin/csep-programs");
    expect(ordinaryAdminHrefs).not.toContain("/superadmin");
    expect(ordinaryAdminHrefs).not.toContain("/superadmin/cyber-security");
    expect(ordinaryAdminHrefs).not.toContain("/superadmin/csep-programs");
  });

  it("does not repeat superadmin tool hrefs across grouped sections", () => {
    const hrefs = superadminOnlySideSections.flatMap((section) =>
      section.items.map((item) => item.href)
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("quick-link rows do not repeat the same href twice in one list", () => {
    const lists = [
      ["userQuickLinks", userQuickLinks],
      ["adminQuickLinks", adminQuickLinks],
      ["companyAdminQuickLinks", companyAdminQuickLinks],
      ["companyManagerQuickLinks", companyManagerQuickLinks],
      ["companyUserQuickLinks", companyUserQuickLinks],
      ["accountSetupQuickLinks", accountSetupQuickLinks],
    ] as const;

    for (const [name, items] of lists) {
      const hrefs = items.map((i) => i.href);
      expect(new Set(hrefs).size, `${name}: duplicate href`).toBe(hrefs.length);
    }
  });

  it("keeps section ordering consistent with intended nav structure", () => {
    // Quick links lead with the primary nav anchors for both roles
    expect(companyAdminQuickLinks.slice(0, 3).map((item) => item.href)).toEqual([
      "/command-center",
      "/dashboard",
      "/jobsites",
    ]);
    expect(companyManagerQuickLinks.slice(0, 3).map((item) => item.href)).toEqual([
      "/command-center",
      "/dashboard",
      "/jobsites",
    ]);

    // Command Center lives in "Start Here", not in Insights
    const adminStartSection = companyAdminSideSections.find((s) => s.title === "Start Here");
    const managerStartSection = companyManagerSideSections.find((s) => s.title === "Start Here");
    expect(adminStartSection?.items.some((i) => i.href === "/command-center")).toBe(true);
    expect(managerStartSection?.items.some((i) => i.href === "/command-center")).toBe(true);

    const adminInsightsSection = companyAdminSideSections.find(
      (section) => section.title === "Insights & Reports"
    );
    const managerInsightsSection = companyManagerSideSections.find(
      (section) => section.title === "Insights & Reports"
    );

    // Insights leads with Safety Intelligence then Predictive Model
    expect(adminInsightsSection?.items.slice(0, 2).map((item) => item.href)).toEqual([
      "/safety-intelligence",
      "/analytics/predictive-model",
    ]);
    expect(managerInsightsSection?.items.slice(0, 2).map((item) => item.href)).toEqual([
      "/safety-intelligence",
      "/analytics/predictive-model",
    ]);

    // Safety Analytics is present in the insights section
    expect(adminInsightsSection?.items.some((i) => i.href === "/analytics")).toBe(true);
    expect(managerInsightsSection?.items.some((i) => i.href === "/analytics")).toBe(true);

    // Workflow Activity (/analytics/safety-intelligence) is intentionally absent from
    // the sidebar — it was removed as a confusing near-duplicate of Safety Analytics
    expect(adminInsightsSection?.items.some((i) => i.href === "/analytics/safety-intelligence")).toBe(false);
    expect(managerInsightsSection?.items.some((i) => i.href === "/analytics/safety-intelligence")).toBe(false);
  });
});

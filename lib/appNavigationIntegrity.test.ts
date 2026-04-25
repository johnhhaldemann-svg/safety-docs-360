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

  it("keeps the insights section ordering centered on Command Center first", () => {
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

    const adminInsightsSection = companyAdminSideSections.find(
      (section) => section.title === "Insights & intelligence"
    );
    const managerInsightsSection = companyManagerSideSections.find(
      (section) => section.title === "Insights & intelligence"
    );

    expect(adminInsightsSection?.items.slice(0, 2).map((item) => item.href)).toEqual([
      "/command-center",
      "/safety-intelligence",
    ]);
    expect(managerInsightsSection?.items.slice(0, 2).map((item) => item.href)).toEqual([
      "/command-center",
      "/safety-intelligence",
    ]);
  });
});

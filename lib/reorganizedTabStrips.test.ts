import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JOBSITE_NAV_PHASES } from "@/lib/jobsiteWorkspaceNav";
import { WORKSPACE_NAV_GROUP_ORDER } from "@/lib/workspaceNavigationModel";

const REPO_ROOT = join(import.meta.dirname, "..");

describe("Reorganized tab strips (release contracts)", () => {
  it("jobsite workspace nav collapses to five parent phases", () => {
    expect(JOBSITE_NAV_PHASES.map((p) => p.label)).toEqual([
      "Overview",
      "Field work",
      "Compliance",
      "Documents",
      "Insights",
    ]);
  });

  it("workspace sidebar uses five ordered groups", () => {
    expect([...WORKSPACE_NAV_GROUP_ORDER]).toEqual([
      "today",
      "fieldSites",
      "programs",
      "insights",
      "account",
    ]);
  });

  it("CSEP builder defines four phase categories", () => {
    const src = readFileSync(join(REPO_ROOT, "app/(app)/csep/page.tsx"), "utf8");
    for (const title of ["Setup", "Scope", "Build", "Review & Submit"] as const) {
      expect(src, `missing phase "${title}"`).toContain(`title: "${title}"`);
    }
  });

  it("PSHSEP builder defines four phase categories", () => {
    const src = readFileSync(join(REPO_ROOT, "app/(app)/peshep/page.tsx"), "utf8");
    for (const title of ["Setup", "Scope", "Build", "Review & Submit"] as const) {
      expect(src, `missing phase "${title}"`).toContain(`title: "${title}"`);
    }
  });

  it("analytics page defines four primary tab ids", () => {
    const src = readFileSync(join(REPO_ROOT, "app/(app)/analytics/page.tsx"), "utf8");
    expect(src).toContain('const ANALYTICS_TAB_IDS = ["overview", "observations", "inspections", "risk"]');
  });

  it("command center hub uses three URL-synced tabs", () => {
    const src = readFileSync(join(REPO_ROOT, "components/command-center/CommandCenterWorkspace.tsx"), "utf8");
    expect(src).toContain('const COMMAND_CENTER_HUB_TABS = ["now", "risk", "knowledge"]');
    expect(src).toContain("AppTabBar");
    expect(src).toContain("useUrlTabState");
  });

  it("library exposes three primary tabs via AppTabBar", () => {
    const src = readFileSync(join(REPO_ROOT, "app/(app)/library/page.tsx"), "utf8");
    expect(src).toContain('const LIBRARY_PRIMARY_TABS = ["documents", "templates", "marketplace"]');
    expect(src).toContain("<AppTabBar");
  });

  it("Safety Intelligence workflow lists four main stages", () => {
    const src = readFileSync(join(REPO_ROOT, "components/safety-intelligence/SafetyIntelligenceWorkflow.tsx"), "utf8");
    expect(src).toContain('["intake", "Intake",');
    expect(src).toContain('["rules", "Rules & conflicts",');
    expect(src).toContain('["generate", "Generate",');
    expect(src).toContain('["review", "Review",');
  });

  it("JSA workspace lists four top-level tabs", () => {
    const src = readFileSync(join(REPO_ROOT, "components/jsa/JsaWorkspace.tsx"), "utf8");
    expect(src).toContain('["setup", "Setup"]');
    expect(src).toContain('["hazards", "Hazards"]');
    expect(src).toContain('["ppe", "PPE & Permits"]');
    expect(src).toContain('["signoff", "Sign-off"]');
  });

  it("Safety review panel keeps three review modes", () => {
    const src = readFileSync(join(REPO_ROOT, "components/safety-intelligence/SafetyReviewPanel.tsx"), "utf8");
    expect(src).toContain('"gaps"');
    expect(src).toContain('"permits"');
    expect(src).toContain('"training_ppe"');
    expect(src).toContain("Training & PPE");
  });

  it("admin jobsite audits Excel section uses segmented buttons not nested Radix tabs", () => {
    const src = readFileSync(join(REPO_ROOT, "app/(app)/admin/jobsite-audits/page.tsx"), "utf8");
    expect(src).toContain("excelWorkbook");
    expect(src).not.toMatch(/<Tabs\.Root[^>]*defaultValue="hs"/);
  });
});

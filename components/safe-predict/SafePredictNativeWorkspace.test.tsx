import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SafePredictNativeWorkspace,
  SettingsProfileHub,
  type SettingsUserContext,
} from "@/components/safe-predict/SafePredictNativeWorkspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/safe-predict/SafePredictDataProvider", async () => {
  const { buildSafePredictDataset } = await import("@/lib/safePredictData");
  const dataset = buildSafePredictDataset({
    mode: "live",
    liveCompany: { name: "Test Constructors" },
    liveJobsites: [
      { id: "live-high", name: "North Pier Expansion", status: "active" },
      { id: "live-low", name: "South Yard Closeout", status: "active" },
    ],
    liveActions: [
      { id: "act-1", jobsite_id: "live-high", title: "Repair guardrail", status: "in_progress", severity: "high" },
      { id: "act-2", jobsite_id: "live-low", title: "Closed punch item", status: "verified_closed", severity: "low" },
    ],
    liveIncidents: [{ id: "inc-1", jobsite_id: "live-high", title: "Near miss at stair tower", status: "open", severity: "high" }],
    liveInspections: [{ id: "audit-1", jobsite_id: "live-high", title: "Daily walk", status: "failed", failed_items: 2 }],
    liveDocuments: [{ id: "doc-1", jobsite_id: "live-high", title: "North Pier JSA", document_type: "JSA", status: "approved" }],
  });

  return {
    useSafePredictData: () => ({
      dataset,
      loading: false,
      mode: "live",
      selectedJobsiteId: "live-high",
      setSelectedJobsiteId: vi.fn(),
      setMode: vi.fn(),
      updateActionStatus: vi.fn(),
      closeActionWithPhoto: vi.fn(),
      advanceActionStatus: vi.fn(),
      addDraftAction: vi.fn((input) => ({ id: "draft-action", ...input, status: "New", progress: 0 })),
      addDraftHazard: vi.fn(),
      addDraftIncident: vi.fn(),
      addDraftPermit: vi.fn(),
      addDraftJobsite: vi.fn(),
    }),
  };
});

describe("SafePredictNativeWorkspace analytics", () => {
  it("scopes analytics cards, forecast, heat map, and table to the selected jobsite", () => {
    const html = renderToStaticMarkup(<SafePredictNativeWorkspace workspace="analytics" />);

    expect(html).toContain("Risk Forecast - North Pier Expansion");
    expect(html).toContain("North Pier Expansion");
    expect(html).toContain("Risk Analytics By Jobsite");
    expect(html).toContain("Selected jobsite");
    expect(html).toContain("1 jobsites");
    expect(html).toContain("1 open actions");
  });

  it("renders the new-platform document control register", () => {
    const html = renderToStaticMarkup(<SafePredictNativeWorkspace workspace="documents" />);

    expect(html).toContain("Documents");
    expect(html).toContain("Document Control Register");
    expect(html).toContain("North Pier JSA");
    expect(html).toContain("/safe-predict/documents");
  });

  it("opens incident logging from the native workspace instead of linking back to itself", () => {
    const html = renderToStaticMarkup(<SafePredictNativeWorkspace workspace="incidents" />);

    expect(html).toContain("Log Incident");
    expect(html).not.toContain('href="/safe-predict/incidents"');
  });

  it("renders the settings profile card and preserves existing settings controls", () => {
    const html = renderToStaticMarkup(<SafePredictNativeWorkspace workspace="settings" />);

    expect(html).toContain("My Profile");
    expect(html).toContain("Edit Profile");
    expect(html).toContain("Workspace Data Mode");
    expect(html).toContain("Predictability Engine");
    expect(html).toContain("Risk Thresholds");
  });
});

describe("SettingsProfileHub", () => {
  const companyAdminUser = {
    email: "jack@example.com",
    role: "company_admin",
    roleLabel: "Company Admin",
    team: "TJ Contracting",
    companyId: "company-1",
    companyName: "TJ Contracting",
    profileComplete: true,
    permissionMap: { can_manage_company_users: true },
    profile: {
      fullName: "Jack Jane",
      preferredName: "Jack",
      jobTitle: "Safety Director",
      tradeSpecialty: "General Contractor",
    },
  } satisfies SettingsUserContext;

  it("shows company admin functions for company admins", () => {
    const html = renderToStaticMarkup(<SettingsProfileHub user={companyAdminUser} />);

    expect(html).toContain("Jack");
    expect(html).toContain("Company Admin Functions");
    expect(html).toContain("Team &amp; Access");
    expect(html).toContain('href="/safe-predict/profile"');
    expect(html).toContain('href="/safe-predict/team-access"');
    expect(html).toContain('href="/safe-predict/apps-integrations"');
    expect(html).toContain('href="/safe-predict/onboarding-import"');
    expect(html).toContain('href="/safe-predict/training-tracker"');
    expect(html).toContain('href="/safe-predict/safety-forms"');
    expect(html).toContain('href="/safe-predict/inductions"');
    expect(html).toContain('href="/safe-predict/billing"');
    expect(html).toContain('href="/safe-predict/risk-memory"');
    expect(html).not.toContain('href="/profile"');
    expect(html).not.toContain('href="/company-users"');
    expect(html).not.toContain('href="/company-integrations"');
    expect(html).not.toContain('href="/settings/risk-memory"');
    expect(html).not.toContain('href="/admin');
  });

  it("does not show company admin functions for non-admin users", () => {
    const user = {
      ...companyAdminUser,
      role: "company_user",
      roleLabel: "Company User",
      permissionMap: { can_manage_company_users: false },
    } satisfies SettingsUserContext;
    const html = renderToStaticMarkup(<SettingsProfileHub user={user} />);

    expect(html).toContain("My Profile");
    expect(html).not.toContain("Company Admin Functions");
    expect(html).not.toContain('href="/company-users"');
  });
});

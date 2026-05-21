import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_TAB_IDS,
  DashboardDetailsTabs,
  readDashboardTab,
} from "@/src/components/dashboard/DashboardDetailsTabs";

describe("DashboardDetailsTabs", () => {
  it("renders the compact dashboard tabs and the active panel", () => {
    const html = renderToStaticMarkup(
      <DashboardDetailsTabs
        activeTab="operations"
        onTabChange={vi.fn()}
        panels={{
          operations: <section>Current Safety Health</section>,
          trends: <section>Smart Safety Forecast</section>,
          risks: <section>Corrective Action Control Center</section>,
          readiness: <section>Document Readiness</section>,
          system: <section>Smart Safety Engine Health</section>,
        }}
      />
    );

    expect(html).toContain("Detail Console");
    expect(html).toContain("Operations");
    expect(html).toContain("Trends");
    expect(html).toContain("Risks");
    expect(html).toContain("Readiness");
    expect(html).toContain("System Health");
    expect(html).toContain("Current Safety Health");
  });

  it("falls back to operations for unknown query tab values", () => {
    expect(readDashboardTab("risks")).toBe("risks");
    expect(readDashboardTab("unknown")).toBe("operations");
    expect(readDashboardTab(null)).toBe("operations");
  });

  it("keeps every active tab label readable on the selected background", () => {
    for (const activeTab of DASHBOARD_TAB_IDS) {
      const html = renderToStaticMarkup(
        <DashboardDetailsTabs
          activeTab={activeTab}
          onTabChange={vi.fn()}
          panels={{
            operations: <section>Current Safety Health</section>,
            trends: <section>Smart Safety Forecast</section>,
            risks: <section>Corrective Action Control Center</section>,
            readiness: <section>Document Readiness</section>,
            system: <section>Smart Safety Engine Health</section>,
          }}
        />
      );

      expect(html).toContain('data-state="active"');
      expect(html).toContain("data-[state=active]:!bg-[var(--app-text-strong)]");
      expect(html).toContain("data-[state=active]:!text-white");
      expect(html).toContain("Risks");
      expect(html).toContain("System Health");
    }
  });
});

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { demoSafePredictDataset } from "@/lib/safePredictData";
import { generateSafePredictWorkforceReportPdf, type SafePredictWorkforceReportKind } from "@/lib/safePredictWorkforceReportPdf";

function workforceTotals() {
  const workers = demoSafePredictDataset.employees.length;
  const compliant = demoSafePredictDataset.employees.filter((employee) => employee.status === "compliant").length;
  const expiringSoon = demoSafePredictDataset.employees.filter((employee) => employee.status === "expiring").length;
  const overdue = demoSafePredictDataset.employees.filter((employee) => employee.status === "overdue").length;
  return {
    workers,
    compliant,
    expiringSoon,
    overdue,
    compliantPercent: Math.round((compliant / workers) * 100),
    expiringSoonPercent: Math.round((expiringSoon / workers) * 100),
    overduePercent: Math.round((overdue / workers) * 100),
  };
}

function reportParams(kind: SafePredictWorkforceReportKind) {
  const trades = demoSafePredictDataset.tradeReadiness.map((trade) => {
    const statuses = [trade.fallProtection, trade.confinedSpace, trade.loto, trade.hazcom, trade.firstAid];
    return {
      ...trade,
      overdueCount: statuses.filter((status) => status === "overdue").length,
      expiringCount: statuses.filter((status) => status === "expiring").length,
      compliantCount: statuses.filter((status) => status === "compliant").length,
    };
  });

  return {
    kind,
    company: demoSafePredictDataset.company,
    workforce: workforceTotals(),
    permits: demoSafePredictDataset.permitSummaries.reduce(
      (total, row) => ({
        active: total.active + row.active,
        expiringSoon: total.expiringSoon + row.expiringSoon,
        expired: total.expired + row.expired,
      }),
      { active: 0, expiringSoon: 0, expired: 0 }
    ),
    employees: demoSafePredictDataset.employees,
    jobsites: demoSafePredictDataset.jobsites,
    trades,
    permitGroups: [
      { category: "Hot Work / Fire", active: 4, expiringSoon: 2, expired: 1, missingSignatures: 1 },
      { category: "Energy Control", active: 3, expiringSoon: 1, expired: 0, missingSignatures: 0 },
    ],
    workflowItems: [
      {
        kind: "permit",
        title: "Renew hot work permit",
        detail: "Expired permit exposure at Riverside Commercial Tower.",
        actionTitle: "Renew or review hot work permit",
        linkedRisk: "Hot work permit readiness",
        siteName: "Riverside Commercial Tower",
        severity: "critical",
        dueAt: "2026-05-24",
      },
      {
        kind: "training",
        title: "Resolve training readiness",
        detail: "Overdue training for electrical crew.",
        actionTitle: "Resolve training readiness",
        linkedRisk: "Electrical readiness gap",
        siteName: "Plant 1 Modernization",
        severity: "high",
        dueAt: "2026-05-28",
      },
    ],
  };
}

describe("SafePredict workforce PDF reports", () => {
  it.each<SafePredictWorkforceReportKind>(["command", "training", "permit"])("generates a readable %s PDF", async (kind) => {
    const report = await generateSafePredictWorkforceReportPdf(reportParams(kind));
    const doc = await PDFDocument.load(report.bytes);

    expect(report.filename).toMatch(/\.pdf$/);
    expect(report.bytes.length).toBeGreaterThan(2_000);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

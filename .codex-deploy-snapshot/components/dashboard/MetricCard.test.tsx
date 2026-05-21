import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricCard } from "@/src/components/dashboard/MetricCard";

describe("MetricCard", () => {
  it("renders dashboard drill-down cards as links when href is provided", () => {
    const html = renderToStaticMarkup(
      <MetricCard
        label="Compliant"
        value="84%"
        statusBand="green"
        href="/training-matrix?status=complete"
      />
    );

    expect(html).toContain('href="/training-matrix?status=complete"');
    expect(html).toContain("Compliant");
  });
});

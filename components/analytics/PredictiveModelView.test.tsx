import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PredictiveModelView } from "@/components/analytics/PredictiveModelView";
import { buildEmptyPredictiveRiskPayload, buildSalesDemoPredictiveRiskPayload } from "@/lib/predictiveRisk";

describe("PredictiveModelView", () => {
  it("renders populated predictive risk sections", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView
        data={buildSalesDemoPredictiveRiskPayload(30)}
        loading={false}
        error=""
        days={30}
      />
    );

    expect(html).toContain("Predict risk before it happens");
    expect(html).toContain("Top locations by predicted risk");
    expect(html).toContain("Top risk drivers");
    expect(html).toContain("Recommended actions");
    expect(html).toContain("North Tower");
  });

  it("renders loading metric placeholders", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView data={null} loading error="" days={30} />
    );

    expect(html).toContain("High risk locations");
    expect(html).toContain("Loading");
  });

  it("renders the error state", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView data={null} loading={false} error="Could not load model." days={30} />
    );

    expect(html).toContain("Could not load model.");
  });

  it("renders the empty state", () => {
    const html = renderToStaticMarkup(
      <PredictiveModelView
        data={buildEmptyPredictiveRiskPayload(30)}
        loading={false}
        error=""
        days={30}
      />
    );

    expect(html).toContain("No predictive risk signals yet");
  });
});

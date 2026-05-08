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
    expect(html).toContain("How these numbers work");
    expect(html).toContain("Methodology notes");
    expect(html).toContain("lower is better, higher is worse");
    expect(html).toContain("0 means no active risk signals");
    expect(html).toContain("100 means the location hit the cap");
    expect(html).toContain("Positive trend means risk pressure is increasing");
    expect(html).toContain("Higher is worse; 100 is the cap");
    expect(html).toContain("0 is best, 100 is highest risk pressure");
    expect(html).toContain("Positive is worsening, negative is improving");
    expect(html).toContain("Share of active risk categories in the selected window.");
    expect(html).toContain("Confidence reflects data and model coverage, not a safety grade.");
    expect(html).toContain("Human Behavior Risk");
    expect(html).toContain("Coaching and verification guidance");
    expect(html).toContain("Field verification required");
    expect(html).toContain("Behavior Risk by Trade");
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

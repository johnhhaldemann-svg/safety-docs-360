import { describe, expect, it } from "vitest";
import { APP_BRAND, defaultGusResearchUserAgent, defaultNwsUserAgent, productSentence } from "@/lib/appBrand";

describe("APP_BRAND", () => {
  it("uses the active product identity without legacy ownership copy", () => {
    const values = [
      APP_BRAND.productName,
      APP_BRAND.shortName,
      APP_BRAND.description,
      productSentence(APP_BRAND.productName),
      defaultNwsUserAgent(),
      defaultGusResearchUserAgent(),
    ].join(" ");

    expect(values).toContain("SafePredict");
    expect(values).not.toMatch(/Safety360Docs|SafetyDocs360|Safety360 Docs/i);
  });
});

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_ENGINE_SURFACES } from "@/lib/superadmin/aiEngineOperations";
import { AI_ENGINE_SURFACE_CONTEXT_POLICIES, getAiEngineSurfaceContextPolicy } from "@/lib/aiEngine/surfaceContextPolicy";

describe("AI Engine surface context policy", () => {
  it("documents approved graph context behavior for every active surface", () => {
    const policiesBySurface = new Map(AI_ENGINE_SURFACE_CONTEXT_POLICIES.map((policy) => [policy.surface, policy]));

    expect(AI_ENGINE_SURFACE_CONTEXT_POLICIES).toHaveLength(AI_ENGINE_SURFACES.length);
    for (const surface of AI_ENGINE_SURFACES) {
      const policy = policiesBySurface.get(surface);
      expect(policy, `${surface} must have a context policy`).toBeTruthy();
      expect(policy?.highRiskFallbackBehavior).toBeTruthy();
      if (policy?.usesApprovedGraphContext) {
        expect(policy.brainSurface).toBeTruthy();
        expect(policy.exceptionReason).toBeNull();
        expect(policy.staticProofFiles.length).toBeGreaterThan(0);
      } else {
        expect(policy?.brainSurface).toBeNull();
        expect(policy?.exceptionReason).toMatch(/\w{8,}/);
      }
    }
  });

  it("proves graph-backed surfaces call retrieveAiEngineBrainContext in declared codepaths", () => {
    for (const policy of AI_ENGINE_SURFACE_CONTEXT_POLICIES.filter((item) => item.usesApprovedGraphContext)) {
      const matches = policy.staticProofFiles.map((file) => {
        const absolute = join(process.cwd(), file);
        expect(existsSync(absolute), `${policy.surface} proof file missing: ${file}`).toBe(true);
        return readFileSync(absolute, "utf8").includes("retrieveAiEngineBrainContext");
      });
      expect(matches.some(Boolean), `${policy.surface} must call retrieveAiEngineBrainContext`).toBe(true);
    }
  });

  it("requires high-risk recommendation surfaces to use graph context or human-review fallback behavior", () => {
    const customerFacingRecommendationSurfaces = [
      "safety-intelligence",
      "company-memory",
      "permit-copilot",
      "csep-review",
      "gc-review",
      "injury-weather",
      "field-audits.ai-review",
    ];

    for (const surface of customerFacingRecommendationSurfaces) {
      expect(getAiEngineSurfaceContextPolicy(surface)?.highRiskFallbackBehavior).toBe("requires_company_graph_or_human_review");
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRouteResponse } from "@/lib/routeResponseTest";

const {
  authorizeRequest,
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
  getCompanyScope,
} = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  canMutateCompanyTrainingRequirements: vi.fn(),
  canViewCompanyTrainingMatrix: vi.fn(),
  getCompanyScope: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  authorizeRequest,
  isCompanyRole: (role: string) => role.startsWith("company_") || role === "safety_manager",
}));
vi.mock("@/lib/companyScope", () => ({ getCompanyScope }));
vi.mock("@/lib/companyTrainingAccess", () => ({
  canMutateCompanyTrainingRequirements,
  canViewCompanyTrainingMatrix,
}));

import { POST } from "./route";

function makeSupabase() {
  const insert = vi.fn((payload: Record<string, unknown>) => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "req-1",
          company_id: "company-1",
          title: payload.title,
          sort_order: payload.sort_order,
          match_keywords: payload.match_keywords,
          match_fields: payload.match_fields,
          apply_trades: payload.apply_trades,
          apply_positions: payload.apply_positions,
          apply_sub_trades: payload.apply_sub_trades,
          apply_task_codes: payload.apply_task_codes,
          renewal_months: payload.renewal_months,
          is_generated: payload.is_generated,
          generated_source_type: null,
          generated_source_document_id: null,
          generated_source_operation_key: null,
          training_delivery_type: payload.training_delivery_type,
          training_resource_title: payload.training_resource_title,
          training_resource_url: payload.training_resource_url,
          training_resource_instructions: payload.training_resource_instructions,
        },
        error: null,
      }),
    })),
  }));
  return {
    insert,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      insert,
    })),
  };
}

function request(body: Record<string, unknown>) {
  return new Request("https://example.com/api/company/training-requirements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/company/training-requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMutateCompanyTrainingRequirements.mockReturnValue(true);
    canViewCompanyTrainingMatrix.mockReturnValue(true);
    getCompanyScope.mockResolvedValue({ companyId: "company-1", companyName: "Builder Co" });
  });

  it("creates a requirement with a secure online training resource", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      permissionMap: {},
      team: "Builder Co",
      user: { id: "admin-1" },
      supabase,
    });

    const response = requireRouteResponse(
      await POST(
        request({
          title: "Fall Protection",
          keywords: "Fall Protection",
          applyTrades: ["General Conditions / Site Management"],
          applyPositions: ["Foreman"],
          trainingDeliveryType: "online",
          trainingResourceTitle: "Fall protection course",
          trainingResourceUrl: "https://training.example.com/fall-protection",
          trainingResourceInstructions: "Complete the quiz and upload the certificate.",
        })
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.requirement.trainingResourceUrl).toBe("https://training.example.com/fall-protection");
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        training_delivery_type: "online",
        training_resource_title: "Fall protection course",
        training_resource_url: "https://training.example.com/fall-protection",
      })
    );
  });

  it("creates a requirement with an internal training path", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      permissionMap: {},
      team: "Builder Co",
      user: { id: "admin-1" },
      supabase,
    });

    const response = requireRouteResponse(
      await POST(
        request({
          title: "Site Orientation",
          keywords: "Site Orientation",
          applyTrades: ["General Conditions / Site Management"],
          applyPositions: ["Foreman"],
          trainingDeliveryType: "internal",
          trainingResourceTitle: "Hillcrest site orientation",
          trainingResourceUrl: "/training/hillcrest-orientation",
        })
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.requirement.trainingDeliveryType).toBe("internal");
    expect(json.requirement.trainingResourceUrl).toBe("/training/hillcrest-orientation");
  });

  it("rejects unsafe or blank training resource URLs", async () => {
    const supabase = makeSupabase();
    authorizeRequest.mockResolvedValue({
      role: "company_admin",
      permissionMap: {},
      team: "Builder Co",
      user: { id: "admin-1" },
      supabase,
    });

    const unsafe = requireRouteResponse(
      await POST(
        request({
          title: "LOTO",
          keywords: "LOTO",
          applyTrades: ["Electrical"],
          applyPositions: ["Journeyman"],
          trainingDeliveryType: "online",
          trainingResourceUrl: "http://training.example.com/loto",
        })
      )
    );
    const blank = requireRouteResponse(
      await POST(
        request({
          title: "LOTO",
          keywords: "LOTO",
          applyTrades: ["Electrical"],
          applyPositions: ["Journeyman"],
          trainingDeliveryType: "online",
          trainingResourceUrl: "",
        })
      )
    );

    expect(unsafe.status).toBe(400);
    expect((await unsafe.json()).error).toContain("https://");
    expect(blank.status).toBe(400);
    expect((await blank.json()).error).toContain("Training resource URL is required");
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});

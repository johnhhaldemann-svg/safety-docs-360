import { describe, expect, it } from "vitest";
import {
  buildIncidentFacetRow,
  parseRiskMemoryPayload,
  upsertRiskMemoryFacet,
  type CompanyRiskMemoryFacetInsert,
} from "./facets";

describe("riskMemory facets", () => {
  it("parses sub-trade and task codes into facet payloads", () => {
    const parsed = parseRiskMemoryPayload({
      riskMemory: {
        trade: "Electrical",
        subTrade: "Power distribution / feeders / branch power",
        task: "Conduit install",
        primaryHazard: "electrical",
      },
    });

    expect(parsed).toMatchObject({
      trade_code: "electrical",
      sub_trade_code: "power_distribution_feeders_branch_power",
      task_code: "conduit_install",
      primary_hazard_code: "electrical",
    });
  });

  it("keeps legacy payloads readable when no sub-trade or task is provided", () => {
    const parsed = parseRiskMemoryPayload({
      riskMemory: {
        trade: "Electrical",
        primaryHazard: "electrical",
      },
    });

    expect(parsed).toMatchObject({
      trade_code: "electrical",
      sub_trade_code: null,
      task_code: null,
      primary_hazard_code: "electrical",
    });
  });

  it("hydrates incident facet rows with the new hierarchy fields", () => {
    const row = buildIncidentFacetRow(
      "company-1",
      {
        id: "incident-1",
        jobsite_id: null,
        exposure_event_type: "electrical",
        severity: "high",
        category: "recordable",
        injury_time_of_day: "morning",
      },
      {
        riskMemory: {
          trade: "Electrical",
          subTrade: "Power distribution / feeders / branch power",
          task: "Conduit install",
        },
      }
    );

    expect(row.trade_code).toBe("electrical");
    expect(row.sub_trade_code).toBe("power_distribution_feeders_branch_power");
    expect(row.task_code).toBe("conduit_install");
  });

  it("falls back when Supabase schema cache has not picked up hierarchy columns yet", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const supabase = {
      from() {
        return {
          upsert(payload: Record<string, unknown>) {
            calls.push(payload);
            if (calls.length === 1) {
              return Promise.resolve({
                error: {
                  message:
                    "Could not find the 'sub_trade_code' column of 'company_risk_memory_facets' in the schema cache",
                },
              });
            }
            return Promise.resolve({ error: null });
          },
        };
      },
    } as unknown;

    const row: CompanyRiskMemoryFacetInsert = {
      company_id: "company-1",
      jobsite_id: null,
      source_module: "incident",
      source_id: "incident-1",
      scope_of_work_code: null,
      trade_code: "electrical",
      sub_trade_code: "power_distribution_feeders_branch_power",
      task_code: "conduit_install",
      primary_hazard_code: "electrical",
      secondary_hazard_codes: [],
      root_cause_level1: null,
      root_cause_level2: null,
      failed_control_code: null,
      weather_condition_code: null,
      potential_severity_code: null,
      actual_outcome_severity_code: null,
      contractor_label: null,
      location_area: null,
      time_of_day_band: null,
      permit_status_summary: null,
      ppe_status_summary: null,
      corrective_action_status: null,
      contractor_id: null,
      behavior_category: null,
      training_status: null,
      supervision_status: null,
      equipment_type: null,
      cost_impact_band: null,
      forecast_confidence: null,
      location_grid: null,
      crew_id: null,
      details: {},
    };

    const result = await upsertRiskMemoryFacet(
      supabase as never,
      row
    );

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].sub_trade_code).toBe(
      "power_distribution_feeders_branch_power"
    );
    expect(calls[0].task_code).toBe("conduit_install");
    expect(calls[1].sub_trade_code).toBeUndefined();
    expect(calls[1].task_code).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { CONSTRUCTION_TRADE_DEFINITIONS } from "@/lib/sharedTradeTaxonomy";
import {
  CORE_FIELD_AUDIT_SECTION_IDS,
  countFieldAuditItemsInSections,
  getFieldAuditSectionsForTrade,
} from "./fieldAuditTradeScope";
import { OSHA_FIELD_AUDIT_SECTIONS } from "./oshaFieldAuditTemplate";

describe("fieldAuditTradeScope", () => {
  it("general_contractor returns the full template (same section count and ids)", () => {
    const full = getFieldAuditSectionsForTrade("general_contractor");
    expect(full.length).toBe(OSHA_FIELD_AUDIT_SECTIONS.length);
    expect(full.map((s) => s.id)).toEqual(OSHA_FIELD_AUDIT_SECTIONS.map((s) => s.id));
  });

  it("electrical is a strict subset of the full checklist", () => {
    const gcIds = new Set(OSHA_FIELD_AUDIT_SECTIONS.map((s) => s.id));
    const elec = getFieldAuditSectionsForTrade("electrical");
    expect(elec.length).toBeLessThan(OSHA_FIELD_AUDIT_SECTIONS.length);
    for (const s of elec) {
      expect(gcIds.has(s.id)).toBe(true);
    }
  });

  it("unknown trade falls back to core sections in template order", () => {
    const allowed = new Set<string>(CORE_FIELD_AUDIT_SECTION_IDS);
    const expectedIds = OSHA_FIELD_AUDIT_SECTIONS.filter((s) => allowed.has(s.id)).map(
      (s) => s.id
    );
    const core = getFieldAuditSectionsForTrade("not-a-blueprint-trade-xyz");
    expect(core.map((s) => s.id)).toEqual(expectedIds);
  });

  it("countFieldAuditItemsInSections matches item totals for scoped sections", () => {
    const scoped = getFieldAuditSectionsForTrade("other");
    expect(countFieldAuditItemsInSections(scoped)).toBe(
      scoped.reduce((n, s) => n + s.items.length, 0)
    );
  });

  it("returns at least the core checklist for every supported top-level trade", () => {
    for (const trade of CONSTRUCTION_TRADE_DEFINITIONS) {
      const scoped = getFieldAuditSectionsForTrade(trade.slug);
      expect(scoped.length).toBeGreaterThan(0);
      const ids = new Set(scoped.map((section) => section.id));
      for (const coreId of CORE_FIELD_AUDIT_SECTION_IDS) {
        expect(ids.has(coreId)).toBe(true);
      }
    }
  });
});

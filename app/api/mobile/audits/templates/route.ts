import { NextResponse } from "next/server";
import { AUDIT_SYSTEM_BLUEPRINT } from "@/lib/jobsiteAudits/auditSystemBlueprint";
import { getFieldAuditSectionsForTrade } from "@/lib/jobsiteAudits/fieldAuditTradeScope";
import { CONSTRUCTION_TRADE_LABEL_BY_SLUG, SHARED_TRADE_DEFINITIONS } from "@/lib/sharedTradeTaxonomy";

export const runtime = "nodejs";

export async function GET() {
  const trades = AUDIT_SYSTEM_BLUEPRINT.audit_system.audit_header.trade_scope_being_audited;
  return NextResponse.json({
    templates: trades.map((trade) => ({
      id: trade,
      title: CONSTRUCTION_TRADE_LABEL_BY_SLUG[trade] ?? trade.replaceAll("_", " "),
      fieldScope: SHARED_TRADE_DEFINITIONS.find((definition) => definition.slug === trade)?.fieldScope ?? "other",
      csepKind: SHARED_TRADE_DEFINITIONS.find((definition) => definition.slug === trade)?.csepKind ?? "other_common",
      sections: getFieldAuditSectionsForTrade(trade),
    })),
  });
}

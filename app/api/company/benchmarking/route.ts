import { NextResponse } from "next/server";
import {
  normalizeIndustryCode,
  parseBenchmarkRate,
  parseHoursWorked,
} from "@/lib/benchmarking/companyBenchmarks";
import { getIndustryBenchmarkRates } from "@/lib/benchmarking/industryBenchmarkDataset";
import { authorizeRequest, isAdminRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function canManageBenchmarks(role: string) {
  return isAdminRole(role) || role === "company_admin" || role === "manager" || role === "safety_manager";
}

function serializeRow(row: {
  industry_code?: string | null;
  industry_injury_rate?: number | null;
  trade_injury_rate?: number | null;
  hours_worked?: number | null;
}) {
  const industryCode = row.industry_code ?? null;
  return {
    industryCode,
    industryInjuryRate: row.industry_injury_rate ?? null,
    tradeInjuryRate: row.trade_injury_rate ?? null,
    hoursWorked: row.hours_worked ?? null,
    industryBenchmarkRates: getIndustryBenchmarkRates(industryCode),
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_analytics", "can_view_all_company_data", "can_manage_company_users"],
  });
  if ("error" in auth) return auth.error;
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json(
      serializeRow({
        industry_code: null,
        industry_injury_rate: null,
        trade_injury_rate: null,
        hours_worked: null,
      })
    );
  }
  const result = await auth.supabase
    .from("companies")
    .select("industry_code, industry_injury_rate, trade_injury_rate, hours_worked")
    .eq("id", companyScope.companyId)
    .maybeSingle();
  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to load benchmarking settings." }, { status: 500 });
  }
  return NextResponse.json(serializeRow((result.data as Record<string, unknown>) ?? {}));
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_all_company_data"],
  });
  if ("error" in auth) return auth.error;
  if (!canManageBenchmarks(auth.role)) {
    return NextResponse.json({ error: "Only company admins and safety leads can update benchmarking settings." }, { status: 403 });
  }
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const patch: {
    industry_code?: string | null;
    industry_injury_rate?: number | null;
    trade_injury_rate?: number | null;
    hours_worked?: number | null;
    updated_by: string;
  } = { updated_by: auth.user.id };

  if (
    !body ||
    !["industryCode", "industryInjuryRate", "tradeInjuryRate", "hoursWorked"].some((key) => key in body)
  ) {
    return NextResponse.json({ error: "No benchmarking fields to update." }, { status: 400 });
  }

  if ("industryCode" in body) {
    const code = normalizeIndustryCode(body.industryCode);
    if (body.industryCode !== null && body.industryCode !== "" && !code) {
      return NextResponse.json(
        { error: "industryCode must be a NAICS code (2–6 digits), or null to clear." },
        { status: 400 }
      );
    }
    patch.industry_code = code;
  }
  if ("industryInjuryRate" in body) {
    const r = parseBenchmarkRate(body.industryInjuryRate);
    if (body.industryInjuryRate !== null && body.industryInjuryRate !== "" && r === null) {
      return NextResponse.json(
        { error: "industryInjuryRate must be a non-negative number, or null to clear." },
        { status: 400 }
      );
    }
    patch.industry_injury_rate = r;
  }
  if ("tradeInjuryRate" in body) {
    const r = parseBenchmarkRate(body.tradeInjuryRate);
    if (body.tradeInjuryRate !== null && body.tradeInjuryRate !== "" && r === null) {
      return NextResponse.json(
        { error: "tradeInjuryRate must be a non-negative number, or null to clear." },
        { status: 400 }
      );
    }
    patch.trade_injury_rate = r;
  }
  if ("hoursWorked" in body) {
    const h = parseHoursWorked(body.hoursWorked);
    if (body.hoursWorked !== null && body.hoursWorked !== "" && h === null) {
      return NextResponse.json(
        { error: "hoursWorked must be a non-negative number, or null to clear." },
        { status: 400 }
      );
    }
    patch.hours_worked = h;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing Supabase service role; cannot update company benchmarking." },
      { status: 500 }
    );
  }

  const result = await admin
    .from("companies")
    .update(patch)
    .eq("id", companyScope.companyId)
    .select("industry_code, industry_injury_rate, trade_injury_rate, hours_worked")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message || "Failed to update benchmarking settings." }, { status: 500 });
  }

  const row = (result.data as Record<string, unknown>) ?? {};
  return NextResponse.json({
    success: true,
    ...serializeRow(row),
  });
}

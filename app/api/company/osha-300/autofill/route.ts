import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { aiAutofillOsha300 } from "@/lib/osha300";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/company/osha-300/autofill
// Body: { incidentId: string, apply?: boolean }
//   incidentId — single incident to auto-fill
//   apply — if true, write the suggestions back to the incident record (default false)
//
// Returns: { suggestion, applied }
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_view_dashboards", "can_access_field_work"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    incidentId?: string;
    apply?: boolean;
  } | null;

  const incidentId = body?.incidentId?.trim();
  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required." }, { status: 400 });
  }
  const apply = body?.apply !== false; // default true

  // Load the incident
  const { data: incident, error: incidentError } = await auth.supabase
    .from("company_incidents")
    .select(`
      id, title, description, category, severity,
      injury_type, body_part, exposure_event_type,
      days_away_from_work, days_restricted, fatality, recordable
    `)
    .eq("id", incidentId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (incidentError || !incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const row = incident as {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    severity: string;
    injury_type: string | null;
    body_part: string | null;
    exposure_event_type: string | null;
    days_away_from_work: number;
    days_restricted: number;
    fatality: boolean;
    recordable: boolean;
  };

  const suggestion = await aiAutofillOsha300(row);
  if (!suggestion) {
    return NextResponse.json({ error: "AI auto-fill failed. Please try again." }, { status: 500 });
  }

  let applied = false;
  if (apply) {
    const update: Record<string, unknown> = {
      recordable: suggestion.recordable,
      osha_description: suggestion.descriptionOfInjury,
      osha_autofilled_at: new Date().toISOString(),
    };
    // Only update injury_type / body_part if the incident doesn't have them
    if (!row.injury_type && suggestion.injuryType) update.injury_type = suggestion.injuryType;
    if (!row.body_part && suggestion.bodyPart) update.body_part = suggestion.bodyPart;
    if (suggestion.recordable) {
      if (suggestion.classification === "days_away") {
        update.lost_time = true;
        if (row.days_away_from_work === 0 && suggestion.daysAwayEstimate > 0) {
          update.days_away_from_work = suggestion.daysAwayEstimate;
        }
      }
      if (suggestion.classification === "restricted") {
        update.job_transfer = true;
        if (row.days_restricted === 0 && suggestion.daysRestrictedEstimate > 0) {
          update.days_restricted = suggestion.daysRestrictedEstimate;
        }
      }
    }

    const { error: updateError } = await auth.supabase
      .from("company_incidents")
      .update(update)
      .eq("id", incidentId)
      .eq("company_id", companyScope.companyId);

    applied = !updateError;
  }

  return NextResponse.json({ suggestion, applied, incidentId });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// GET /api/public/site/[siteId] — public endpoint (no auth required)
// Returns site info for the QR code landing page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  if (!siteId?.trim()) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  // Anonymous read via anon key — only returns what we explicitly select
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Look up by slug OR id
  const { data: jobsite } = await supabase
    .from("jobsites")
    .select(`
      id, name, address, city, state, status,
      emergency_contact_name, emergency_contact_phone,
      company:company_id ( name, logo_url )
    `)
    .or(`slug.eq.${siteId},id.eq.${siteId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!jobsite) {
    return NextResponse.json({ error: "Site not found or inactive." }, { status: 404 });
  }

  const companyId = (jobsite as unknown as Record<string, unknown>).company_id as string | undefined;

  // Active hazards (open corrective actions tagged to this jobsite, high/critical)
  const { data: hazardRows } = companyId
    ? await supabase
        .from("corrective_actions")
        .select("id, title, severity, description")
        .eq("jobsite_id", (jobsite as { id: string }).id)
        .in("status", ["open", "in_progress"])
        .in("severity", ["high", "critical"])
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  // Recent safety notices (last 3 company incidents/near-misses, all severities)
  const { data: noticeRows } = companyId
    ? await supabase
        .from("company_incidents")
        .select("id, title, created_at")
        .eq("jobsite_id", (jobsite as { id: string }).id)
        .in("category", ["near_miss", "incident"])
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: [] };

  return NextResponse.json({
    site: {
      ...(jobsite as object),
      activeHazards: hazardRows ?? [],
      recentNotices: noticeRows ?? [],
    },
  });
}

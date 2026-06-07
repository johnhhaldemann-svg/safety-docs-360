import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/public/site/[siteId]/report — anonymous hazard/near-miss report from QR page
// Body: { message: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim().slice(0, 2_000);

  if (!siteId?.trim() || !message) {
    return NextResponse.json({ error: "siteId and message are required." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Look up jobsite
  const { data: jobsite } = await supabase
    .from("jobsites")
    .select("id, name, company_id")
    .or(`slug.eq.${siteId},id.eq.${siteId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!jobsite) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const js = jobsite as { id: string; name: string; company_id: string };

  // Create anonymous incident
  const { data: incident, error: incidentError } = await supabase
    .from("company_incidents")
    .insert({
      company_id: js.company_id,
      jobsite_id: js.id,
      title: `Anonymous QR Report — ${js.name}`,
      description: message,
      category: "near_miss",
      severity: "medium",
      status: "open",
      source: "qr_code",
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (incidentError || !incident) {
    return NextResponse.json({ error: "Failed to submit report." }, { status: 500 });
  }

  // Notify safety managers
  const { data: recipients } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", js.company_id)
    .in("role", ["company_admin", "safety_manager"])
    .eq("status", "active")
    .limit(10);

  if (recipients && recipients.length > 0) {
    const notifications = (recipients as Array<{ user_id: string }>).map((r) => ({
      user_id: r.user_id,
      company_id: js.company_id,
      type: "qr_anonymous_report",
      title: "Anonymous QR Report Received",
      message: `An anonymous hazard report was submitted at ${js.name}: "${message.slice(0, 120)}"`,
      link: `/field-id-exchange?incident=${(incident as { id: string }).id}`,
      read: false,
    }));
    await supabase.from("company_notifications").insert(notifications);
  }

  return NextResponse.json({ ok: true, incidentId: (incident as { id: string }).id });
}

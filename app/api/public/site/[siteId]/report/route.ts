import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ── Simple in-process rate limiter ───────────────────────────────────────────
// 5 requests per 10 minutes per IP. Works within a single Vercel instance;
// for multi-instance deployments, upgrade to Upstash Redis in a later pass.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000; // 10 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Prune expired entries periodically to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

// POST /api/public/site/[siteId]/report — anonymous hazard/near-miss report from QR page
// Body: { message: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { siteId: rawSiteId } = await params;
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim().slice(0, 2_000);

  // Validate siteId to prevent SQL injection via .or() string interpolation
  const siteId = rawSiteId?.trim() ?? "";
  const isSafeId = /^[a-zA-Z0-9_-]{1,120}$/.test(siteId);

  if (!siteId || !isSafeId || !message) {
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
    await Promise.resolve(supabase.from("company_notifications").insert(notifications))
      .catch((err: unknown) => console.error("[qr-report] Notification insert failed:", err));
  }

  return NextResponse.json({ ok: true, incidentId: (incident as { id: string }).id });
}

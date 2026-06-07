import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateTwilioSignature, buildTwimlReply, parseSmsToIncident } from "@/lib/twilioSms";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/webhooks/twilio-sms
// Called by Twilio when an SMS is received on a configured number.
// This endpoint is PUBLIC (no user auth) — validated via Twilio HMAC signature.
export async function POST(request: Request) {
  // Parse form-encoded Twilio payload
  const contentType = request.headers.get("content-type") ?? "";
  let params: Record<string, string> = {};

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    params = Object.fromEntries(new URLSearchParams(text).entries());
  } else {
    return new Response(buildTwimlReply("Invalid request format."), {
      status: 400,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const toNumber = params["To"] ?? "";
  const fromNumber = params["From"] ?? "";
  const smsBody = params["Body"] ?? "";
  const twilioSignature = request.headers.get("X-Twilio-Signature") ?? "";

  if (!toNumber || !smsBody.trim()) {
    return new Response(buildTwimlReply("Message not processed — missing data."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Service-role client — bypasses RLS so we can look up Twilio settings
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Look up company by Twilio phone number
  const { data: settings } = await supabase
    .from("company_twilio_settings")
    .select("id, company_id, auth_token, enabled")
    .eq("phone_number", toNumber)
    .maybeSingle();

  if (!settings || !settings.enabled) {
    return new Response(buildTwimlReply("This number is not configured for incident reporting."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Validate Twilio signature
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.safetydocs360.com"}/api/webhooks/twilio-sms`;
  const isValid = validateTwilioSignature({
    authToken: settings.auth_token,
    twilioSignature,
    url: webhookUrl,
    params,
  });

  if (!isValid) {
    return new Response(buildTwimlReply("Signature validation failed."), {
      status: 403,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const companyId = settings.company_id as string;

  // Parse SMS body with AI
  const draft = await parseSmsToIncident(smsBody);

  if (!draft) {
    return new Response(
      buildTwimlReply("We received your message but could not extract incident details. Please contact your safety manager directly."),
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  // Find a jobsite for this company to attach the incident to (use first active)
  const { data: jobsite } = await supabase
    .from("jobsites")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create the incident via service-role (no user session)
  const { data: incident, error: incidentError } = await supabase
    .from("company_incidents")
    .insert({
      company_id: companyId,
      jobsite_id: jobsite?.id ?? null,
      title: draft.title,
      description: `[SMS from ${fromNumber}]\n\n${draft.description}`,
      category: draft.category,
      severity: draft.severity,
      status: "open",
      occurred_at: new Date().toISOString(),
      source: "sms",
      sms_from_number: fromNumber,
      sms_body: smsBody.slice(0, 2_000),
    })
    .select("id")
    .single();

  if (incidentError || !incident) {
    console.error("[twilio-sms] Failed to create incident:", incidentError);
    return new Response(
      buildTwimlReply("We received your message but had trouble saving it. Please contact your safety manager directly."),
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  // Notify company admins / safety managers in-app
  const { data: recipients } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .in("role", ["company_admin", "safety_manager"])
    .eq("status", "active")
    .limit(10);

  if (recipients && recipients.length > 0) {
    const notifications = recipients.map((r: { user_id: string }) => ({
      user_id: r.user_id,
      company_id: companyId,
      type: "sms_incident_reported",
      title: "New SMS Incident Report",
      message: `An incident was reported via SMS from ${fromNumber}: "${draft.title}"`,
      link: `/field-id-exchange?incident=${incident.id}`,
      read: false,
    }));

    await supabase.from("company_notifications").insert(notifications).then(() => {});
  }

  const confirmMsg = `✅ Incident logged: "${draft.title}" (${draft.severity} severity). Your safety team has been notified. Ref: ${(incident.id as string).slice(0, 8).toUpperCase()}`;

  return new Response(buildTwimlReply(confirmMsg), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

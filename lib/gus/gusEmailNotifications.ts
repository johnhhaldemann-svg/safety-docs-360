import { sanitizeGusMessage } from "@/lib/gus/gusSafetyGate";
import { validateGusOutput } from "@/lib/gus/gusValidation";

type GusEmailNotificationInput = {
  toEmail: string;
  companyName?: string | null;
  jobsiteName?: string | null;
  senderName?: string | null;
  subject?: string | null;
  message: string;
  reason?: string | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  confirmed: boolean;
};

type GusEmailNotificationPayload = {
  toEmail: string;
  subject: string;
  html: string;
  text: string;
  message: string;
  reason: string | null;
  actionLabel: string | null;
  actionHref: string | null;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getGusNotificationFromEmail() {
  return (
    readEnv("GUS_NOTIFICATION_FROM_EMAIL") ??
    readEnv("SAFETY_NOTIFICATION_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL") ??
    readEnv("COMPANY_INVITE_FROM_EMAIL")
  );
}

function getBaseUrl() {
  return (
    readEnv("NEXT_PUBLIC_SITE_URL") ??
    readEnv("SITE_URL") ??
    (readEnv("VERCEL_PROJECT_PRODUCTION_URL")
      ? `https://${readEnv("VERCEL_PROJECT_PRODUCTION_URL")}`
      : null) ??
    (readEnv("VERCEL_URL") ? `https://${readEnv("VERCEL_URL")}` : null)
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(value: unknown, maxLength = 1_200) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanSubject(value: string) {
  return cleanText(value, 100).replace(/[\r\n]+/g, " ");
}

export function isValidGusNotificationEmail(value: unknown) {
  const email = cleanText(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function buildGusEmailNotificationPayload(
  input: GusEmailNotificationInput,
): { ok: true; payload: GusEmailNotificationPayload } | { ok: false; error: string } {
  if (!input.confirmed) {
    return { ok: false, error: "Gus needs user confirmation before sending an email notification." };
  }

  const toEmail = isValidGusNotificationEmail(input.toEmail);
  if (!toEmail) {
    return { ok: false, error: "A valid recipient email is required." };
  }

  const rawMessage = cleanText(input.message, 1_200);
  if (!rawMessage) {
    return { ok: false, error: "A Gus message is required before sending a notification." };
  }

  const rawReason = cleanText(input.reason, 800);
  const rawActionLabel = cleanText(input.actionLabel, 80);
  const rawActionHref = cleanText(input.actionHref, 500);
  const subject = cleanSubject(input.subject || "Gus safety review notification");
  const companyName = cleanText(input.companyName || "your company", 120);
  const jobsiteName = cleanText(input.jobsiteName || "", 120);
  const senderName = cleanText(input.senderName || "A SafetyDocs360 user", 120);
  const baseUrl = getBaseUrl();
  const actionUrl = rawActionHref && baseUrl
    ? new URL(rawActionHref, baseUrl).toString()
    : rawActionHref || null;

  const candidate = {
    subject,
    message: rawMessage,
    reason: rawReason || null,
    actionLabel: rawActionLabel || null,
    actionHref: actionUrl,
    draftOnly: true,
    humanReviewRequired: true,
  };
  const validation = validateGusOutput(candidate);
  if (validation.blocked) {
    return { ok: false, error: "Gus cannot send a notification for that action." };
  }

  const safe = validation.sanitizedOutput;
  const safeSubject = cleanSubject(safe.subject || "Gus safety review notification");
  const safeMessage = sanitizeGusMessage(cleanText(safe.message, 1_200));
  const safeReason = safe.reason ? sanitizeGusMessage(cleanText(safe.reason, 800)) : null;
  const safeActionLabel = safe.actionLabel ? cleanText(safe.actionLabel, 80) : null;
  const safeActionHref = safe.actionHref ? cleanText(safe.actionHref, 500) : null;

  const contextRows = [
    `<p style="margin:0 0 8px;"><strong>Company:</strong> ${escapeHtml(companyName)}</p>`,
    jobsiteName ? `<p style="margin:0;"><strong>Jobsite:</strong> ${escapeHtml(jobsiteName)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const actionHtml = safeActionHref && safeActionLabel
    ? `
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(safeActionHref)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;">
            ${escapeHtml(safeActionLabel)}
          </a>
        </p>
      `
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:20px;padding:28px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#2563eb;font-weight:700;margin:0 0 12px;">Gus AI Safety Coach</p>
        <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">${escapeHtml(safeSubject)}</h1>
        <p style="margin:0 0 16px;color:#475569;">
          ${escapeHtml(senderName)} sent this Gus safety review note from SafetyDocs360.
        </p>
        <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin:0 0 20px;background:#f8fafc;">
          ${contextRows}
        </div>
        <p style="margin:0 0 16px;color:#0f172a;font-size:16px;">${escapeHtml(safeMessage)}</p>
        ${safeReason ? `<p style="margin:0 0 20px;color:#475569;">${escapeHtml(safeReason)}</p>` : ""}
        ${actionHtml}
        <p style="margin:0;color:#64748b;font-size:13px;">
          Draft guidance only. Human review is required before work starts. Gus does not approve work, submit official records, or provide legal advice.
        </p>
      </div>
    </div>
  `.trim();

  const text = [
    `Gus AI Safety Coach: ${safeSubject}`,
    `${senderName} sent this SafetyDocs360 safety review note.`,
    `Company: ${companyName}`,
    jobsiteName ? `Jobsite: ${jobsiteName}` : null,
    safeMessage,
    safeReason,
    safeActionHref && safeActionLabel ? `${safeActionLabel}: ${safeActionHref}` : null,
    "Draft guidance only. Human review is required before work starts. Gus does not approve work, submit official records, or provide legal advice.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    payload: {
      toEmail,
      subject: safeSubject,
      html,
      text,
      message: safeMessage,
      reason: safeReason,
      actionLabel: safeActionLabel,
      actionHref: safeActionHref,
    },
  };
}

export async function sendGusEmailNotification(input: GusEmailNotificationInput) {
  const built = buildGusEmailNotificationPayload(input);
  if (!built.ok) return { sent: false, status: "blocked" as const, warning: built.error };

  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getGusNotificationFromEmail();
  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      status: "skipped" as const,
      warning:
        "Gus email notification was not sent because email delivery is not configured. Add RESEND_API_KEY and GUS_NOTIFICATION_FROM_EMAIL in Vercel.",
      payload: built.payload,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [built.payload.toEmail],
      subject: built.payload.subject,
      html: built.payload.html,
      text: built.payload.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      sent: false,
      status: "failed" as const,
      warning: errorText.trim() || "The email provider rejected the Gus notification.",
      payload: built.payload,
    };
  }

  const responsePayload = (await response.json().catch(() => null)) as { id?: string } | null;
  return {
    sent: true,
    status: "sent" as const,
    providerMessageId: responsePayload?.id ?? null,
    payload: built.payload,
  };
}

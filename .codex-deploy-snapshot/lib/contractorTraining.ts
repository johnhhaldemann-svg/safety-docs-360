import crypto from "node:crypto";

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getContractorTrainingBaseUrl() {
  return (
    readEnv("NEXT_PUBLIC_SITE_URL") ??
    readEnv("SITE_URL") ??
    (readEnv("VERCEL_PROJECT_PRODUCTION_URL")
      ? `https://${readEnv("VERCEL_PROJECT_PRODUCTION_URL")}`
      : null) ??
    (readEnv("VERCEL_URL") ? `https://${readEnv("VERCEL_URL")}` : null)
  );
}

export function normalizeEmail(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || null;
}

export function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export function normalizeSmsPhoneNumber(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function normalizeTrainingTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function parseExpirationMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const title = normalizeTrainingTitle(key);
    const date = String(raw ?? "").trim();
    if (title && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      out[title] = date;
    }
  }
  return out;
}

export function generateIntakeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashIntakeToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildContractorIntakeUrl(token: string) {
  const baseUrl = getContractorTrainingBaseUrl();
  if (!baseUrl) return null;
  const url = new URL("/contractor-training-intake", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildQrImageUrl(value: string) {
  const url = new URL("https://quickchart.io/qr");
  url.searchParams.set("text", value);
  url.searchParams.set("size", "210");
  url.searchParams.set("margin", "2");
  return url.toString();
}

function getContractorTrainingFromEmail() {
  return (
    readEnv("CONTRACTOR_INTAKE_FROM_EMAIL") ??
    readEnv("COMPANY_INVITE_FROM_EMAIL") ??
    readEnv("INVITE_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL")
  );
}

export async function sendContractorIntakeEmail(params: {
  toEmail: string;
  employeeName: string;
  companyName: string;
  jobsiteName: string;
  intakeUrl: string;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getContractorTrainingFromEmail();

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      warning:
        "Intake link created, but email delivery is not configured. Add RESEND_API_KEY and CONTRACTOR_INTAKE_FROM_EMAIL or COMPANY_INVITE_FROM_EMAIL.",
    };
  }

  const qrImageUrl = buildQrImageUrl(params.intakeUrl);
  const safeUrl = escapeHtml(params.intakeUrl);
  const safeEmployee = escapeHtml(params.employeeName || "Contractor employee");
  const safeCompany = escapeHtml(params.companyName);
  const safeJobsite = escapeHtml(params.jobsiteName);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">Contractor Training Intake</p>
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">Submit training for ${safeJobsite}</h1>
        <p style="margin:0 0 16px;color:#475569;">${safeCompany} requested updated contractor training information for ${safeEmployee}.</p>
        <p style="margin:0 0 24px;"><a href="${safeUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">Open Intake Form</a></p>
        <p style="margin:0 0 12px;color:#475569;">You can also scan this code:</p>
        <p style="margin:0 0 24px;"><img src="${qrImageUrl}" width="210" height="210" alt="QR code for contractor training intake" /></p>
        <p style="margin:0;color:#64748b;font-size:14px;">If the button does not open, use this link:<br /><a href="${safeUrl}" style="color:#0284c7;">${safeUrl}</a></p>
      </div>
    </div>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.toEmail],
      subject: `Training intake for ${params.jobsiteName}`,
      html,
      text: [
        `${params.companyName} requested contractor training information for ${params.employeeName}.`,
        `Jobsite: ${params.jobsiteName}`,
        params.intakeUrl,
      ].join("\n\n"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      sent: false,
      warning: errorText.trim() || "Intake link created, but the email provider rejected the outgoing message.",
    };
  }

  return { sent: true, warning: null };
}

export async function sendContractorIntakeSms(params: {
  toPhone: string;
  companyName: string;
  jobsiteName: string;
  intakeUrl: string;
}) {
  const accountSid = readEnv("TWILIO_ACCOUNT_SID");
  const authToken = readEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = readEnv("TWILIO_FROM_NUMBER");
  const messagingServiceSid = readEnv("TWILIO_MESSAGING_SERVICE_SID");
  const toPhone = normalizeSmsPhoneNumber(params.toPhone);

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return {
      sent: false,
      warning:
        "Invite link created, but SMS delivery is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.",
    };
  }
  if (!toPhone) {
    return {
      sent: false,
      warning:
        "Invite link created, but the phone number must include a valid US 10-digit number or an international number with a country code.",
    };
  }

  const body = [
    `${params.companyName} requested contractor training information for ${params.jobsiteName}.`,
    params.intakeUrl,
  ].join(" ");
  const form = new URLSearchParams({
    To: toPhone,
    Body: body,
  });
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    form.set("From", fromNumber);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      sent: false,
      warning: errorText.trim() || "Invite link created, but the SMS provider rejected the outgoing message.",
    };
  }

  return { sent: true, warning: null };
}

export type ContractorTrainingRecord = {
  title: string;
  completed_on?: string | null;
  expires_on?: string | null;
};

export function contractorTrainingStatus(record: ContractorTrainingRecord | null, asOf = new Date()) {
  if (!record) return "missing" as const;
  if (!record.completed_on && !record.expires_on) return "missing" as const;
  if (!record.expires_on) return "complete" as const;
  const today = new Date(asOf.toISOString().slice(0, 10));
  const expiry = new Date(record.expires_on);
  if (Number.isNaN(expiry.getTime())) return "complete" as const;
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired" as const;
  if (diffDays <= 30) return "expiring" as const;
  return "complete" as const;
}

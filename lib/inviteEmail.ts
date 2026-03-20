function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
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

function getInviteFromEmail() {
  return (
    readEnv("COMPANY_INVITE_FROM_EMAIL") ??
    readEnv("INVITE_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL")
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

export function buildCompanyInviteSignupUrl(email: string) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return null;
  }

  const url = new URL("/login", baseUrl);
  url.searchParams.set("mode", "signup");
  url.searchParams.set("email", email);
  url.searchParams.set("invite", "company");
  return url.toString();
}

export async function sendCompanyInviteEmail(params: {
  toEmail: string;
  companyName: string;
  roleLabel: string;
  invitedByName: string;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getInviteFromEmail();
  const signupUrl = buildCompanyInviteSignupUrl(params.toEmail);

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      warning:
        "Invite saved, but email delivery is not configured yet. Add RESEND_API_KEY and COMPANY_INVITE_FROM_EMAIL in Vercel to send invite emails automatically.",
    };
  }

  if (!signupUrl) {
    return {
      sent: false,
      warning:
        "Invite saved, but the signup link could not be generated. Add NEXT_PUBLIC_SITE_URL in Vercel to send invite emails automatically.",
    };
  }

  const subject = `You're invited to join ${params.companyName} on Safety360Docs`;
  const safeCompanyName = escapeHtml(params.companyName);
  const safeRoleLabel = escapeHtml(params.roleLabel);
  const safeInvitedByName = escapeHtml(params.invitedByName);
  const safeSignupUrl = escapeHtml(signupUrl);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">Company Invite</p>
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">Join ${safeCompanyName} on Safety360Docs</h1>
        <p style="margin:0 0 16px;color:#475569;">
          ${safeInvitedByName} invited you to join the company workspace as <strong>${safeRoleLabel}</strong>.
        </p>
        <p style="margin:0 0 24px;color:#475569;">
          Create your account with this invited email address and your company access will be attached automatically.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${safeSignupUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">
            Create Your Account
          </a>
        </p>
        <p style="margin:0;color:#64748b;font-size:14px;">
          If the button does not open, use this link:<br />
          <a href="${safeSignupUrl}" style="color:#0284c7;">${safeSignupUrl}</a>
        </p>
      </div>
    </div>
  `.trim();

  const text = [
    `You're invited to join ${params.companyName} on Safety360Docs.`,
    `${params.invitedByName} invited you as ${params.roleLabel}.`,
    "Create your account with this invited email address and your company access will be attached automatically.",
    signupUrl,
  ].join("\n\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.toEmail],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      sent: false,
      warning:
        errorText.trim() ||
        "Invite saved, but the email provider rejected the outgoing message.",
    };
  }

  return {
    sent: true,
    signupUrl,
  };
}

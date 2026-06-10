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

export function buildCompanyInviteLoginUrl(email: string) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return null;
  }

  const url = new URL("/login", baseUrl);
  url.searchParams.set("email", email);
  url.searchParams.set("invite", "company");
  return url.toString();
}

type SendResult = { sent: boolean; warning?: string };

/** Shared Resend sender used by the onboarding lifecycle emails below. */
async function sendResendEmail(params: {
  toEmail: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getInviteFromEmail();

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      warning:
        "Email delivery is not configured yet. Add RESEND_API_KEY and COMPANY_INVITE_FROM_EMAIL in Vercel to send onboarding emails automatically.",
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
      to: [params.toEmail],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      sent: false,
      warning: errorText.trim() || "The email provider rejected the outgoing message.",
    };
  }

  return { sent: true };
}

function onboardingEmailShell(params: {
  eyebrow: string;
  heading: string;
  bodyParagraphs: string[];
}) {
  const paragraphs = params.bodyParagraphs
    .map(
      (p) => `<p style="margin:0 0 16px;color:#475569;">${p}</p>`
    )
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">${escapeHtml(
          params.eyebrow
        )}</p>
        <h1 style="font-size:26px;line-height:1.15;margin:0 0 16px;">${escapeHtml(params.heading)}</h1>
        ${paragraphs}
      </div>
    </div>
  `.trim();
}

/** Confirmation sent to the applicant immediately after they submit a workspace request. */
export async function sendCompanySignupReceivedEmail(params: {
  toEmail: string;
  companyName: string;
  contactName?: string;
}): Promise<SendResult> {
  const greeting = params.contactName?.trim() ? `Hi ${params.contactName.trim()},` : "Hi there,";
  const company = params.companyName.trim() || "your company";
  const bodyParagraphs = [
    escapeHtml(greeting),
    `Thanks for requesting a SafePredict workspace for <strong>${escapeHtml(company)}</strong>. Our team is reviewing it now.`,
    "Once it's approved you'll get a follow-up email with sign-in instructions, then you can sign in with this same email address to open your workspace and finish setup.",
    "No action is needed from you right now.",
  ];
  return sendResendEmail({
    toEmail: params.toEmail,
    subject: `We received your SafePredict workspace request`,
    html: onboardingEmailShell({
      eyebrow: "Request received",
      heading: `Your workspace request is in review`,
      bodyParagraphs,
    }),
    text: [
      greeting,
      `Thanks for requesting a SafePredict workspace for ${company}. Our team is reviewing it now.`,
      "Once it's approved you'll get a follow-up email with sign-in instructions.",
      "No action is needed right now.",
    ].join("\n\n"),
  });
}

/** Notice sent to the applicant when a workspace request is declined, including the reason. */
export async function sendCompanyRejectionEmail(params: {
  toEmail: string;
  companyName: string;
  reason?: string | null;
}): Promise<SendResult> {
  const company = params.companyName.trim() || "your company";
  const reason = params.reason?.trim();
  const bodyParagraphs = [
    `We reviewed the SafePredict workspace request for <strong>${escapeHtml(company)}</strong> and weren't able to approve it at this time.`,
    reason ? `<strong>Reason:</strong> ${escapeHtml(reason)}` : "",
    "If you think this was a mistake or you'd like to discuss it, just reply to this email and our team will help.",
  ].filter(Boolean);
  return sendResendEmail({
    toEmail: params.toEmail,
    subject: `Update on your SafePredict workspace request`,
    html: onboardingEmailShell({
      eyebrow: "Request update",
      heading: `About your workspace request`,
      bodyParagraphs,
    }),
    text: [
      `We reviewed the SafePredict workspace request for ${company} and weren't able to approve it at this time.`,
      reason ? `Reason: ${reason}` : "",
      "If you think this was a mistake, reply to this email and our team will help.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}

export async function sendCompanyInviteEmail(params: {
  toEmail: string;
  companyName: string;
  roleLabel: string;
  invitedByName: string;
  mode?: "signup" | "login";
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getInviteFromEmail();
  const inviteMode = params.mode ?? "signup";
  const destinationUrl =
    inviteMode === "login"
      ? buildCompanyInviteLoginUrl(params.toEmail)
      : buildCompanyInviteSignupUrl(params.toEmail);

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      warning:
        "Invite saved, but email delivery is not configured yet. Add RESEND_API_KEY and COMPANY_INVITE_FROM_EMAIL in Vercel to send invite emails automatically.",
    };
  }

  if (!destinationUrl) {
    return {
      sent: false,
      warning:
        "Invite saved, but the workspace link could not be generated. Add NEXT_PUBLIC_SITE_URL in Vercel to send invite emails automatically.",
    };
  }

  const subject = `You're invited to join ${params.companyName} on SafePredict`;
  const safeCompanyName = escapeHtml(params.companyName);
  const safeRoleLabel = escapeHtml(params.roleLabel);
  const safeInvitedByName = escapeHtml(params.invitedByName);
  const safeDestinationUrl = escapeHtml(destinationUrl);
  const actionLabel =
    inviteMode === "login" ? "Access Your Workspace" : "Create Your Account";
  const actionCopy =
    inviteMode === "login"
      ? "Your company workspace has been approved and your existing account is already linked. Sign in with this email address to open the workspace."
      : "Create your account with this invited email address and your company access will be attached automatically.";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">Company Invite</p>
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">Join ${safeCompanyName} on SafePredict</h1>
        <p style="margin:0 0 16px;color:#475569;">
          ${safeInvitedByName} invited you to join the company workspace as <strong>${safeRoleLabel}</strong>.
        </p>
        <p style="margin:0 0 24px;color:#475569;">
          ${escapeHtml(actionCopy)}
        </p>
        <p style="margin:0 0 24px;">
          <a href="${safeDestinationUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">
            ${actionLabel}
          </a>
        </p>
        <p style="margin:0;color:#64748b;font-size:14px;">
          If the button does not open, use this link:<br />
          <a href="${safeDestinationUrl}" style="color:#0284c7;">${safeDestinationUrl}</a>
        </p>
      </div>
    </div>
  `.trim();

  const text = [
    `You're invited to join ${params.companyName} on SafePredict.`,
    `${params.invitedByName} invited you as ${params.roleLabel}.`,
    actionCopy,
    destinationUrl,
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
    signupUrl: destinationUrl,
  };
}

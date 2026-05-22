export type TrainingExpirationStage = "30d" | "14d" | "7d" | "expired";
export type TrainingExpirationEmailItem = {
  workerName: string;
  workerEmail?: string | null;
  trainingTitle: string;
  expiresOn: string;
  daysUntilExpiry: number;
  stage: TrainingExpirationStage;
  jobsiteName?: string | null;
  subjectType: string;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getTrainingExpirationFromEmail() {
  return (
    readEnv("TRAINING_EXPIRATION_FROM_EMAIL") ??
    readEnv("TRAINING_ASSIGNMENT_FROM_EMAIL") ??
    readEnv("CONTRACTOR_INTAKE_FROM_EMAIL") ??
    readEnv("COMPANY_INVITE_FROM_EMAIL") ??
    readEnv("INVITE_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL")
  );
}

function getBaseUrl() {
  return (
    readEnv("NEXT_PUBLIC_SITE_URL") ??
    readEnv("NEXT_PUBLIC_APP_URL") ??
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

function cleanSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stageLabel(item: Pick<TrainingExpirationEmailItem, "stage" | "daysUntilExpiry">) {
  if (item.stage === "expired") {
    return `${Math.abs(item.daysUntilExpiry)} day${Math.abs(item.daysUntilExpiry) === 1 ? "" : "s"} expired`;
  }
  if (item.daysUntilExpiry === 0) return "expires today";
  return `expires in ${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? "" : "s"}`;
}

function statusTone(stage: TrainingExpirationStage) {
  return stage === "expired" ? "#b91c1c" : stage === "7d" ? "#c2410c" : "#0369a1";
}

function itemRows(items: TrainingExpirationEmailItem[]) {
  return items
    .map((item) => {
      const safeTraining = escapeHtml(item.trainingTitle);
      const safeWorker = escapeHtml(item.workerName || "Worker");
      const safeJobsite = item.jobsiteName ? escapeHtml(item.jobsiteName) : null;
      const safeDate = escapeHtml(formatDate(item.expiresOn));
      const safeStatus = escapeHtml(stageLabel(item));
      const tone = statusTone(item.stage);
      return `
        <tr>
          <td style="padding:12px;border-top:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${safeTraining}</td>
          <td style="padding:12px;border-top:1px solid #e2e8f0;color:#475569;">${safeWorker}</td>
          <td style="padding:12px;border-top:1px solid #e2e8f0;color:#475569;">${safeJobsite ?? "Company workforce"}</td>
          <td style="padding:12px;border-top:1px solid #e2e8f0;color:#475569;">${safeDate}</td>
          <td style="padding:12px;border-top:1px solid #e2e8f0;font-weight:700;color:${tone};">${safeStatus}</td>
        </tr>
      `;
    })
    .join("");
}

function textLines(items: TrainingExpirationEmailItem[]) {
  return items.map((item) =>
    [
      `${item.trainingTitle} - ${stageLabel(item)} (${formatDate(item.expiresOn)})`,
      `Worker: ${item.workerName || "Worker"}`,
      item.jobsiteName ? `Jobsite: ${item.jobsiteName}` : null,
      item.workerEmail ? `Worker email: ${item.workerEmail}` : "Worker email: missing",
    ].filter(Boolean).join("\n")
  );
}

function actionUrl() {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;
  return new URL("/training-matrix", baseUrl).toString();
}

export async function sendTrainingExpirationEmail(params: {
  toEmail: string;
  companyName: string;
  workerItems?: TrainingExpirationEmailItem[];
  managerItems?: TrainingExpirationEmailItem[];
  fetcher?: typeof fetch;
}) {
  const workerItems = params.workerItems ?? [];
  const managerItems = params.managerItems ?? [];
  const total = workerItems.length + managerItems.length;
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getTrainingExpirationFromEmail();
  const url = actionUrl();

  if (total === 0) {
    return { sent: false, status: "skipped" as const, warning: "No training expiration items were provided." };
  }

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      status: "skipped" as const,
      warning:
        "Training expiration email was not sent because email delivery is not configured. Add RESEND_API_KEY and TRAINING_EXPIRATION_FROM_EMAIL in Vercel.",
    };
  }

  const hasManagerDigest = managerItems.length > 0;
  const subject = hasManagerDigest
    ? `Training expiration digest for ${cleanSubject(params.companyName)}`
    : `Training expiring soon for ${cleanSubject(params.companyName)}`;
  const safeCompanyName = escapeHtml(params.companyName || "Your company");
  const safeUrl = url ? escapeHtml(url) : null;

  const sections = [
    workerItems.length
      ? `
        <h2 style="font-size:18px;margin:26px 0 10px;color:#0f172a;">Your training renewals</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr>
              <th align="left" style="padding:10px 12px;color:#64748b;">Training</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Worker</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Scope</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Expires</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Status</th>
            </tr>
          </thead>
          <tbody>${itemRows(workerItems)}</tbody>
        </table>
      `
      : "",
    managerItems.length
      ? `
        <h2 style="font-size:18px;margin:26px 0 10px;color:#0f172a;">Safety manager digest</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr>
              <th align="left" style="padding:10px 12px;color:#64748b;">Training</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Worker</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Scope</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Expires</th>
              <th align="left" style="padding:10px 12px;color:#64748b;">Status</th>
            </tr>
          </thead>
          <tbody>${itemRows(managerItems)}</tbody>
        </table>
      `
      : "",
  ].join("");

  const actionHtml = safeUrl
    ? `
      <p style="margin:24px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">
          Open Training Matrix
        </a>
      </p>
      <p style="margin:0;color:#64748b;font-size:14px;">If the button does not open, use this link:<br /><a href="${safeUrl}" style="color:#0284c7;">${safeUrl}</a></p>
    `
    : `<p style="margin:24px 0 0;color:#64748b;font-size:14px;">Open SafePredict or contact your safety team to update these records.</p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:760px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">Training Expiration</p>
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">Training renewals need attention</h1>
        <p style="margin:0 0 12px;color:#475569;">
          ${safeCompanyName} has ${total} training expiration item${total === 1 ? "" : "s"} in the current reminder window.
        </p>
        ${sections}
        ${actionHtml}
      </div>
    </div>
  `.trim();

  const text = [
    `Training expiration reminder for ${params.companyName || "your company"}.`,
    workerItems.length ? ["Your training renewals:", ...textLines(workerItems)].join("\n\n") : null,
    managerItems.length ? ["Safety manager digest:", ...textLines(managerItems)].join("\n\n") : null,
    url ?? "Open SafePredict or contact your safety team to update these records.",
  ].filter(Boolean).join("\n\n");

  const response = await (params.fetcher ?? fetch)("https://api.resend.com/emails", {
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
      status: "failed" as const,
      warning: errorText.trim() || "Training expiration email provider rejected the message.",
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return {
    sent: true,
    status: "sent" as const,
    providerMessageId: payload?.id ?? null,
  };
}

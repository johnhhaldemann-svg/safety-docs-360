function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getTrainingAssignmentFromEmail() {
  return (
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

function buildTrainingMatrixUrl() {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;
  return new URL("/training-matrix", baseUrl).toString();
}

function buildAbsoluteUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    const baseUrl = getBaseUrl();
    if (!baseUrl || !raw.startsWith("/") || raw.startsWith("//")) return null;
    return new URL(raw, baseUrl).toString();
  }
}

function formatDueDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function sendTrainingAssignmentEmail(params: {
  toEmail: string;
  workerName: string;
  companyName: string;
  assignedByName: string;
  assignmentTitle: string;
  requirementTitle: string;
  detail: string;
  dueAt?: string | null;
  jobsiteName?: string | null;
  resourceTitle?: string | null;
  resourceUrl?: string | null;
  resourceInstructions?: string | null;
  assignmentUrl?: string | null;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getTrainingAssignmentFromEmail();
  const trainingMatrixUrl = buildTrainingMatrixUrl();

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      status: "skipped" as const,
      warning:
        "Training assignment saved, but email delivery is not configured. Add RESEND_API_KEY and TRAINING_ASSIGNMENT_FROM_EMAIL in Vercel.",
    };
  }

  const safeWorkerName = escapeHtml(params.workerName || "Team member");
  const safeCompanyName = escapeHtml(params.companyName || "Your company");
  const safeAssignedByName = escapeHtml(params.assignedByName || "Your safety team");
  const safeAssignmentTitle = escapeHtml(params.assignmentTitle || "Training assignment");
  const safeRequirementTitle = escapeHtml(params.requirementTitle || "Assigned training");
  const safeDetail = escapeHtml(params.detail || "A training follow-up has been assigned.");
  const safeJobsiteName = params.jobsiteName ? escapeHtml(params.jobsiteName) : null;
  const safeResourceTitle = escapeHtml(params.resourceTitle || params.requirementTitle || "Start training");
  const safeResourceInstructions = params.resourceInstructions
    ? escapeHtml(params.resourceInstructions)
    : null;
  const dueDate = formatDueDate(params.dueAt);
  const safeDueDate = dueDate ? escapeHtml(dueDate) : null;
  const safeTrainingMatrixUrl = trainingMatrixUrl ? escapeHtml(trainingMatrixUrl) : null;
  const trainingResourceUrl = buildAbsoluteUrl(params.resourceUrl);
  const safeTrainingResourceUrl = trainingResourceUrl ? escapeHtml(trainingResourceUrl) : null;
  const assignmentUrl = buildAbsoluteUrl(params.assignmentUrl) ?? trainingMatrixUrl;
  const safeAssignmentUrl = assignmentUrl ? escapeHtml(assignmentUrl) : safeTrainingMatrixUrl;
  const subject = `Training assigned: ${cleanSubject(params.requirementTitle || params.assignmentTitle)}`;

  const contextRows = [
    `<p style="margin:0 0 8px;"><strong>Training:</strong> ${safeRequirementTitle}</p>`,
    safeDueDate ? `<p style="margin:0 0 8px;"><strong>Due:</strong> ${safeDueDate}</p>` : "",
    safeJobsiteName ? `<p style="margin:0;"><strong>Jobsite:</strong> ${safeJobsiteName}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const actionHtml = safeTrainingResourceUrl
    ? `
        <p style="margin:0 0 24px;">
          <a href="${safeTrainingResourceUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">
            Start Training
          </a>
        </p>
        ${safeAssignmentUrl ? `<p style="margin:0 0 14px;color:#64748b;font-size:14px;"><a href="${safeAssignmentUrl}" style="color:#0284c7;">Open assignment in SafePredict</a></p>` : ""}
        <p style="margin:0;color:#64748b;font-size:14px;">
          If the button does not open, use this training link:<br />
          <a href="${safeTrainingResourceUrl}" style="color:#0284c7;">${safeTrainingResourceUrl}</a>
        </p>
      `
    : safeTrainingMatrixUrl
      ? `
          <p style="margin:0 0 24px;">
            <a href="${safeTrainingMatrixUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">
              Open Training Matrix
            </a>
          </p>
        `
      : `<p style="margin:0;color:#64748b;font-size:14px;">Contact your supervisor or safety team for the next step.</p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">Training Assignment</p>
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">${safeAssignmentTitle}</h1>
        <p style="margin:0 0 16px;color:#475569;">
          ${safeWorkerName}, ${safeCompanyName} assigned this training follow-up. ${safeAssignedByName} created the assignment.
        </p>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px 20px;margin:0 0 24px;background:#f8fafc;">
          ${contextRows}
        </div>
        <div style="border:1px solid #bae6fd;border-radius:18px;padding:18px 20px;margin:0 0 24px;background:#f0f9ff;">
          <p style="margin:0 0 8px;"><strong>Resource:</strong> ${safeResourceTitle}</p>
          ${safeResourceInstructions ? `<p style="margin:0;color:#475569;">${safeResourceInstructions}</p>` : ""}
        </div>
        <p style="margin:0 0 24px;color:#475569;">${safeDetail}</p>
        ${actionHtml}
      </div>
    </div>
  `.trim();

  const text = [
    `Training assignment: ${params.assignmentTitle}`,
    `Worker: ${params.workerName || "Team member"}`,
    `Company: ${params.companyName || "Your company"}`,
    `Assigned by: ${params.assignedByName || "Your safety team"}`,
    `Training: ${params.requirementTitle || "Assigned training"}`,
    dueDate ? `Due: ${dueDate}` : null,
    params.jobsiteName ? `Jobsite: ${params.jobsiteName}` : null,
    `Resource: ${params.resourceTitle || params.requirementTitle || "Start training"}`,
    params.resourceInstructions ? `Instructions: ${params.resourceInstructions}` : null,
    params.detail || "A training follow-up has been assigned.",
    trainingResourceUrl ? `Start training: ${trainingResourceUrl}` : null,
    assignmentUrl ? `Open assignment: ${assignmentUrl}` : trainingMatrixUrl || null,
    !trainingResourceUrl && !assignmentUrl && !trainingMatrixUrl
      ? "Contact your supervisor or safety team for the next step."
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

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
      status: "failed" as const,
      warning:
        errorText.trim() ||
        "Training assignment saved, but the email provider rejected the outgoing message.",
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return {
    sent: true,
    status: "sent" as const,
    providerMessageId: payload?.id ?? null,
    trainingMatrixUrl,
    trainingResourceUrl,
    assignmentUrl,
  };
}

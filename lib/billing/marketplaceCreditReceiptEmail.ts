function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getReceiptFromEmail() {
  return (
    readEnv("BILLING_RECEIPT_FROM_EMAIL") ??
    readEnv("BILLING_FROM_EMAIL") ??
    readEnv("RESEND_FROM_EMAIL")
  );
}

function getBaseUrl(baseUrl?: string | null) {
  return baseUrl?.trim().replace(/\/$/, "") || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeSubjectValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatCurrency(amountCents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export async function sendMarketplaceCreditPurchaseReceiptEmail(params: {
  toEmail: string;
  companyName: string;
  invoiceNumber: string;
  invoiceId: string;
  baseUrl?: string | null;
  packLabel: string;
  credits: number;
  amountCents: number;
  currency?: string;
}) {
  const resendApiKey = readEnv("RESEND_API_KEY");
  const fromEmail = getReceiptFromEmail();
  const baseUrl = getBaseUrl(params.baseUrl);

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      warning:
        "Receipt not sent because email delivery is not configured yet. Add RESEND_API_KEY and BILLING_RECEIPT_FROM_EMAIL in Vercel to enable billing receipts.",
    };
  }

  if (!baseUrl) {
    return {
      sent: false,
      warning:
        "Receipt not sent because the public site URL could not be resolved. Add NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL in Vercel.",
    };
  }

  const safeCompanyName = escapeHtml(params.companyName);
  const safeInvoiceNumber = escapeHtml(params.invoiceNumber);
  const safePackLabel = escapeHtml(params.packLabel);
  const receiptUrl = `${baseUrl}/customer/billing/invoices/${params.invoiceId}`;
  const safeReceiptUrl = escapeHtml(receiptUrl);
  const subject = `Receipt for ${sanitizeSubjectValue(params.companyName)} marketplace credit purchase`;
  const formattedAmount = formatCurrency(params.amountCents, params.currency);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px;">
      <div style="border:1px solid #dbeafe;border-radius:24px;padding:32px;background:#ffffff;">
        <p style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#0369a1;font-weight:700;margin:0 0 12px;">Billing Receipt</p>
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px;">Marketplace credits purchased for ${safeCompanyName}</h1>
        <p style="margin:0 0 16px;color:#475569;">
          Your marketplace credit order has been paid and the company balance has been updated.
        </p>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px 20px;margin:0 0 24px;background:#f8fafc;">
          <p style="margin:0 0 8px;"><strong>Invoice:</strong> ${safeInvoiceNumber}</p>
          <p style="margin:0 0 8px;"><strong>Pack:</strong> ${safePackLabel}</p>
          <p style="margin:0 0 8px;"><strong>Credits:</strong> ${params.credits}</p>
          <p style="margin:0;"><strong>Total:</strong> ${escapeHtml(formattedAmount)}</p>
        </div>
        <p style="margin:0 0 24px;">
          <a href="${safeReceiptUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">
            View Receipt
          </a>
        </p>
        <p style="margin:0;color:#64748b;font-size:14px;">
          If the button does not open, use this link:<br />
          <a href="${safeReceiptUrl}" style="color:#0284c7;">${safeReceiptUrl}</a>
        </p>
      </div>
    </div>
  `.trim();

  const text = [
    `Marketplace credits purchased for ${params.companyName}.`,
    `Invoice: ${params.invoiceNumber}`,
    `Pack: ${params.packLabel}`,
    `Credits: ${params.credits}`,
    `Total: ${formattedAmount}`,
    receiptUrl,
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
        "Receipt not sent because the email provider rejected the outgoing message.",
    };
  }

  return {
    sent: true,
    receiptUrl,
  };
}

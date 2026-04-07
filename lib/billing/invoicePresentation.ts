export type InvoiceLineItemLike = {
  item_type?: string | null;
  description?: string | null;
  line_total_cents?: number | null;
  quantity?: number | null;
  unit_price_cents?: number | null;
  metadata?: Record<string, unknown> | null;
};

export function getBillingSourceLabel(source?: string | null) {
  const normalized = String(source ?? "").trim().toLowerCase();
  if (normalized === "recurring_company_pricing") {
    return "Recurring company billing";
  }
  if (normalized === "company_pricing") {
    return "Company pricing";
  }
  return "Manual invoice";
}

export function getBillingSourceTone(source?: string | null): "success" | "info" | "neutral" {
  const normalized = String(source ?? "").trim().toLowerCase();
  if (normalized === "recurring_company_pricing") {
    return "success";
  }
  if (normalized === "company_pricing") {
    return "info";
  }
  return "neutral";
}

export function formatBillingPeriodLabel(periodKey?: string | null) {
  const normalized = String(periodKey ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month] = normalized.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function inferChargeBucket(item: InvoiceLineItemLike) {
  const component = String(item.metadata?.billing_component ?? "").trim().toLowerCase();
  if (component === "company_subscription") {
    return "subscription";
  }
  if (component === "licensed_seats") {
    return "licensing";
  }
  return "other";
}

function resolveLineTotal(item: InvoiceLineItemLike) {
  if (typeof item.line_total_cents === "number" && Number.isFinite(item.line_total_cents)) {
    return Math.max(0, Math.floor(item.line_total_cents));
  }

  const quantity = Math.max(0, Math.floor(Number(item.quantity ?? 1)));
  const unitPrice = Math.max(0, Math.floor(Number(item.unit_price_cents ?? 0)));
  return quantity * unitPrice;
}

export function summarizeBillingCharges(items: InvoiceLineItemLike[]) {
  return items.reduce(
    (acc, item) => {
      const bucket = inferChargeBucket(item);
      const amount = resolveLineTotal(item);

      acc.total_cents += amount;
      acc.line_count += 1;

      if (bucket === "subscription") {
        acc.subscription_cents += amount;
        acc.subscription_count += 1;
      } else if (bucket === "licensing") {
        acc.licensing_cents += amount;
        acc.licensing_count += 1;
      } else {
        acc.other_cents += amount;
        acc.other_count += 1;
      }

      return acc;
    },
    {
      total_cents: 0,
      line_count: 0,
      subscription_cents: 0,
      licensing_cents: 0,
      other_cents: 0,
      subscription_count: 0,
      licensing_count: 0,
      other_count: 0,
    }
  );
}

export function getInvoiceSourceSummary(invoice: {
  billing_source?: string | null;
  billing_period_key?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
}) {
  const source = getBillingSourceLabel(invoice.billing_source ?? null);
  const tone = getBillingSourceTone(invoice.billing_source ?? null);
  const periodLabel = formatBillingPeriodLabel(invoice.billing_period_key ?? null);

  const period =
    periodLabel && invoice.billing_period_start && invoice.billing_period_end
      ? `${periodLabel} (${invoice.billing_period_start} to ${invoice.billing_period_end})`
      : periodLabel;

  return {
    source,
    tone,
    period,
    isRecurring: String(invoice.billing_source ?? "").trim().toLowerCase() === "recurring_company_pricing",
    isCompanyPricing: String(invoice.billing_source ?? "").trim().toLowerCase() === "company_pricing",
  };
}

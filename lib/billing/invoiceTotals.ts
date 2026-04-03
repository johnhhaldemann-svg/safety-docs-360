import type { InvoiceTotals, LineItemInput } from "@/lib/billing/types";

/** Basis points: 750 = 7.5% */
export function computeLineTotalCents(quantity: number, unitPriceCents: number): number {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) {
    return 0;
  }
  return Math.round(q * unitPriceCents);
}

export function computeInvoiceTotals(params: {
  lineItems: LineItemInput[];
  discountCents?: number;
  /** Tax rate in basis points applied to (subtotal - discount). */
  taxRateBps?: number;
}): InvoiceTotals {
  const discount_cents = Math.max(0, Math.floor(params.discountCents ?? 0));

  let subtotal_cents = 0;
  for (const row of params.lineItems) {
    subtotal_cents += computeLineTotalCents(row.quantity, row.unit_price_cents);
  }

  const taxable_base = Math.max(0, subtotal_cents - discount_cents);
  const bps = Math.max(0, Math.floor(params.taxRateBps ?? 0));
  const tax_cents = Math.round((taxable_base * bps) / 10_000);
  const total_cents = taxable_base + tax_cents;

  return {
    subtotal_cents,
    discount_cents,
    taxable_cents: taxable_base,
    tax_cents,
    total_cents,
  };
}

export function computeBalanceDue(totalCents: number, amountPaidCents: number): number {
  return Math.max(0, Math.floor(totalCents) - Math.max(0, Math.floor(amountPaidCents)));
}

/**
 * Derive status from stored status, dates, and balance (UTC calendar dates).
 */
export function deriveInvoiceStatus(params: {
  storedStatus: string;
  dueDateYmd: string;
  balanceDueCents: number;
  todayUtcYmd: string;
}): string {
  const locked = new Set(["void", "cancelled", "paid"]);
  if (locked.has(params.storedStatus)) {
    return params.storedStatus;
  }

  if (params.balanceDueCents <= 0 && params.storedStatus !== "draft") {
    return "paid";
  }

  if (
    params.balanceDueCents > 0 &&
    params.dueDateYmd < params.todayUtcYmd &&
    params.storedStatus !== "draft"
  ) {
    return "overdue";
  }

  return params.storedStatus;
}

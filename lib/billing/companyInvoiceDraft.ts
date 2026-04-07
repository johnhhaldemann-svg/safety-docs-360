import type { LineItemInput } from "@/lib/billing/types";

export type CompanyBillingLineItemInput = {
  companyName: string;
  planName: string;
  subscriptionPriceCents: number | null;
  seatPriceCents: number | null;
  seatsUsed: number;
  membershipSeats: number;
  pendingInviteCount: number;
};

export function addUtcDaysToYmd(ymd: string, days: number): string {
  const base = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return ymd;
  }

  base.setUTCDate(base.getUTCDate() + Math.max(0, Math.floor(days)));
  return base.toISOString().slice(0, 10);
}

export function buildCompanyBillingLineItems(
  params: CompanyBillingLineItemInput
): LineItemInput[] {
  const companyName = params.companyName.trim() || "Company";
  const planName = params.planName.trim() || "Subscription";
  const lineItems: LineItemInput[] = [];

  if (params.subscriptionPriceCents != null) {
    lineItems.push({
      item_type: "subscription",
      description: `${planName} subscription`,
      quantity: 1,
      unit_price_cents: Math.max(0, Math.floor(params.subscriptionPriceCents)),
      metadata: {
        billing_component: "company_subscription",
        company_name: companyName,
        plan_name: planName,
      },
    });
  }

  if (params.seatPriceCents != null && params.seatsUsed > 0) {
    lineItems.push({
      item_type: "subscription",
      description: `Licensed user seats (${params.seatsUsed})`,
      quantity: Math.max(1, Math.floor(params.seatsUsed)),
      unit_price_cents: Math.max(0, Math.floor(params.seatPriceCents)),
      metadata: {
        billing_component: "licensed_seats",
        company_name: companyName,
        plan_name: planName,
        seats_used: Math.max(0, Math.floor(params.seatsUsed)),
        membership_seats: Math.max(0, Math.floor(params.membershipSeats)),
        pending_invites: Math.max(0, Math.floor(params.pendingInviteCount)),
      },
    });
  }

  return lineItems;
}

export function buildCompanyBillingNote(params: {
  companyName: string;
  planName: string;
  seatsUsed: number;
}) {
  const companyName = params.companyName.trim() || "the company";
  const planName = params.planName.trim() || "subscription";
  return `Auto-generated billing draft for ${companyName} using the current ${planName} pricing and ${Math.max(
    0,
    Math.floor(params.seatsUsed)
  )} licensed users.`;
}


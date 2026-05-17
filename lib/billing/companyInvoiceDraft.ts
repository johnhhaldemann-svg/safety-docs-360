import type { LineItemInput } from "@/lib/billing/types";
import type { PlatformAddonSelection } from "@/lib/platformPricing";

export type CompanyBillingLineItemInput = {
  companyName: string;
  planName: string;
  annualPlatformPriceCents?: number | null;
  onboardingFeeCents?: number | null;
  selectedAddons?: PlatformAddonSelection[];
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

  if (params.annualPlatformPriceCents != null) {
    lineItems.push({
      item_type: "subscription",
      description: `${planName} annual platform`,
      quantity: 1,
      unit_price_cents: Math.max(0, Math.floor(params.annualPlatformPriceCents)),
      metadata: {
        billing_component: "annual_platform",
        company_name: companyName,
        plan_name: planName,
      },
    });
  }

  if (params.onboardingFeeCents != null && params.onboardingFeeCents > 0) {
    lineItems.push({
      item_type: "consulting",
      description: "Implementation / onboarding",
      quantity: 1,
      unit_price_cents: Math.max(0, Math.floor(params.onboardingFeeCents)),
      metadata: {
        billing_component: "implementation_onboarding",
        company_name: companyName,
        plan_name: planName,
      },
    });
  }

  for (const addon of params.selectedAddons ?? []) {
    if (addon.unitPriceCents == null) {
      continue;
    }
    lineItems.push({
      item_type: "custom",
      description: addon.label,
      quantity: Math.max(1, Math.floor(addon.quantity)),
      unit_price_cents: Math.max(0, Math.floor(addon.unitPriceCents)),
      metadata: {
        billing_component: "platform_addon",
        addon_key: addon.key,
        company_name: companyName,
        plan_name: planName,
        notes: addon.notes ?? null,
      },
    });
  }

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

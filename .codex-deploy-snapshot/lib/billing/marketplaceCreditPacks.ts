export type MarketplaceCreditPack = {
  id: "starter" | "pro" | "max";
  label: string;
  credits: number;
  priceCents: number;
  note: string;
};

export const MARKETPLACE_CREDIT_PACKS: MarketplaceCreditPack[] = [
  {
    id: "starter",
    label: "Starter Pack",
    credits: 10,
    priceCents: 1000,
    note: "Quick top-up for smaller teams or one-off unlocks.",
  },
  {
    id: "pro",
    label: "Pro Pack",
    credits: 25,
    priceCents: 2500,
    note: "A practical balance for recurring document purchases.",
  },
  {
    id: "max",
    label: "Max Pack",
    credits: 50,
    priceCents: 5000,
    note: "Best value for heavier marketplace use and shared teams.",
  },
];

export function getMarketplaceCreditPack(packId?: string | null) {
  const normalized = String(packId ?? "").trim().toLowerCase();
  return (
    MARKETPLACE_CREDIT_PACKS.find((pack) => pack.id === normalized) ?? null
  );
}


import type {
  CSEPPricedItemCatalogEntry,
  CSEPPricedItemSelection,
} from "@/types/csep-priced-items";

type DerivePricedItemsParams = {
  trade?: string | null;
  subTrade?: string | null;
  tasks?: string[];
  selectedHazards?: string[];
  derivedHazards?: string[];
  selectedPermits?: string[];
};

type ResolvePricedItemsParams = {
  selectedKeys?: string[];
  eligibleItems?: CSEPPricedItemCatalogEntry[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

function toCatalogSelection(item: CSEPPricedItemCatalogEntry): CSEPPricedItemSelection {
  return {
    key: item.key,
    label: item.label,
    category: item.category,
    price: item.price,
    source: "catalog",
  };
}

function matchesAny(targets: Set<string>, values?: string[]) {
  if (!values?.length) return false;
  return values.some((value) => targets.has(normalize(value)));
}

function includesTaskToken(taskText: string, tokens?: string[]) {
  if (!tokens?.length) return false;
  return tokens.some((token) => taskText.includes(normalize(token)));
}

export const CSEP_PRICED_ITEM_CATALOG: CSEPPricedItemCatalogEntry[] = [
  {
    key: "hot_work_permit",
    label: "Hot Work Permit",
    category: "permit",
    price: 85,
    triggers: {
      permits: ["Hot Work Permit"],
    },
  },
  {
    key: "confined_space_permit",
    label: "Confined Space Permit",
    category: "permit",
    price: 175,
    triggers: {
      permits: ["Confined Space Permit"],
    },
  },
  {
    key: "loto_permit",
    label: "LOTO Permit",
    category: "permit",
    price: 95,
    triggers: {
      permits: ["LOTO Permit"],
    },
  },
  {
    key: "ladder_permit",
    label: "Ladder Permit",
    category: "permit",
    price: 60,
    triggers: {
      permits: ["Ladder Permit"],
    },
  },
  {
    key: "awp_mewp_permit",
    label: "AWP/MEWP Permit",
    category: "permit",
    price: 145,
    triggers: {
      permits: ["AWP/MEWP Permit"],
    },
  },
  {
    key: "ground_disturbance_permit",
    label: "Ground Disturbance Permit",
    category: "permit",
    price: 210,
    triggers: {
      permits: ["Ground Disturbance Permit"],
    },
  },
  {
    key: "trench_inspection_permit",
    label: "Trench Inspection Permit",
    category: "permit",
    price: 185,
    triggers: {
      permits: ["Trench Inspection Permit"],
    },
  },
  {
    key: "chemical_permit",
    label: "Chemical Permit",
    category: "permit",
    price: 70,
    triggers: {
      permits: ["Chemical Permit"],
    },
  },
  {
    key: "motion_permit",
    label: "Motion Permit",
    category: "permit",
    price: 120,
    triggers: {
      permits: ["Motion Permit"],
    },
  },
  {
    key: "temperature_permit",
    label: "Temperature Permit",
    category: "permit",
    price: 65,
    triggers: {
      permits: ["Temperature Permit"],
    },
  },
  {
    key: "gravity_permit",
    label: "Gravity Permit",
    category: "permit",
    price: 110,
    triggers: {
      permits: ["Gravity Permit"],
    },
  },
  {
    key: "fall_protection_rescue_plan",
    label: "Fall Protection Rescue Plan",
    category: "add_on",
    price: 450,
    triggers: {
      hazards: ["Falls from height"],
      permits: ["Ladder Permit", "AWP/MEWP Permit", "Gravity Permit"],
      taskTokens: [
        "roof",
        "ladder",
        "mewp",
        "elevat",
        "anchor",
        "fall protection",
        "scaffold",
        "steel erection",
      ],
    },
  },
];

export function formatCsepPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function deriveEligibleCsepPricedItems(
  params: DerivePricedItemsParams
): CSEPPricedItemCatalogEntry[] {
  const tradeTargets = new Set(uniq([params.trade ?? "", params.subTrade ?? ""]).map(normalize));
  const hazardTargets = new Set(
    uniq([...(params.selectedHazards ?? []), ...(params.derivedHazards ?? [])]).map(normalize)
  );
  const permitTargets = new Set(uniq(params.selectedPermits ?? []).map(normalize));
  const taskText = uniq(params.tasks ?? []).join(" ").toLowerCase();

  return CSEP_PRICED_ITEM_CATALOG.filter((item) => {
    const tradeMatch =
      matchesAny(tradeTargets, item.triggers.trades) ||
      matchesAny(tradeTargets, item.triggers.subTrades);
    const hazardMatch = matchesAny(hazardTargets, item.triggers.hazards);
    const permitMatch = matchesAny(permitTargets, item.triggers.permits);
    const taskMatch = includesTaskToken(taskText, item.triggers.taskTokens);

    return tradeMatch || hazardMatch || permitMatch || taskMatch;
  });
}

export function resolveSelectedCsepPricedItems(
  params: ResolvePricedItemsParams
): CSEPPricedItemSelection[] {
  const selectedKeys = new Set(uniq(params.selectedKeys ?? []));
  if (selectedKeys.size === 0) return [];

  return (params.eligibleItems ?? [])
    .filter((item) => selectedKeys.has(item.key))
    .map((item) => toCatalogSelection(item));
}

export function normalizePricedItemSelections(value: unknown): CSEPPricedItemSelection[] {
  if (!Array.isArray(value)) return [];

  const catalogByKey = new Map(CSEP_PRICED_ITEM_CATALOG.map((item) => [item.key, item]));
  const selections = new Map<string, CSEPPricedItemSelection>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const key = typeof (entry as { key?: unknown }).key === "string"
      ? (entry as { key: string }).key.trim()
      : "";
    if (!key) continue;

    const catalogItem = catalogByKey.get(key);
    if (catalogItem) {
      selections.set(key, toCatalogSelection(catalogItem));
      continue;
    }

    const label = typeof (entry as { label?: unknown }).label === "string"
      ? (entry as { label: string }).label.trim()
      : "";
    const category = (entry as { category?: unknown }).category;
    const price = (entry as { price?: unknown }).price;

    if (!label) continue;
    if (category !== "permit" && category !== "add_on") continue;
    if (typeof price !== "number" || !Number.isFinite(price)) continue;

    selections.set(key, {
      key,
      label,
      category,
      price,
      source: "catalog",
    });
  }

  return [...selections.values()];
}

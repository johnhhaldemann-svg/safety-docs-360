export type CSEPPricedItemCategory = "permit" | "add_on";

export type CSEPPricedItemTriggerRules = {
  permits?: string[];
  hazards?: string[];
  trades?: string[];
  subTrades?: string[];
  taskTokens?: string[];
};

export type CSEPPricedItemCatalogEntry = {
  key: string;
  label: string;
  category: CSEPPricedItemCategory;
  price: number;
  triggers: CSEPPricedItemTriggerRules;
};

export type CSEPPricedItemSelection = {
  key: string;
  label: string;
  category: CSEPPricedItemCategory;
  price: number;
  source: "catalog";
};

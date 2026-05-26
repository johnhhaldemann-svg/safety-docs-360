import { getWithLegacyStorageFallback } from "@/lib/localStorageMigration";

export type TableDensity = "comfortable" | "compact";

const STORAGE_KEY = "safepredict:tableDensity";
const LEGACY_STORAGE_KEYS = ["safety360:tableDensity"];

export function getStoredTableDensity(): TableDensity {
  if (typeof window === "undefined") {
    return "comfortable";
  }
  try {
    const v = getWithLegacyStorageFallback(window.localStorage, STORAGE_KEY, LEGACY_STORAGE_KEYS);
    if (v === "compact" || v === "comfortable") {
      return v;
    }
  } catch {
    // ignore
  }
  return "comfortable";
}

export function setStoredTableDensity(density: TableDensity) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // ignore
  }
}

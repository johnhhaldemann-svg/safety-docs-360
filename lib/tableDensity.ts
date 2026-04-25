export type TableDensity = "comfortable" | "compact";

const STORAGE_KEY = "safety360:tableDensity";

export function getStoredTableDensity(): TableDensity {
  if (typeof window === "undefined") {
    return "comfortable";
  }
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
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

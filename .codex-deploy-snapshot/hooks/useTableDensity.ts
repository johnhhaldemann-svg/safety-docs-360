"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  getStoredTableDensity,
  setStoredTableDensity,
  type TableDensity,
} from "@/lib/tableDensity";

/**
 * Global preference (localStorage) for compact vs comfortable data tables.
 * Applies the stored value in `useLayoutEffect` so the first paint after
 * hydration can match the user's choice (see `data-table-density` script in root layout).
 */
export function useTableDensity() {
  const [density, setDensityState] = useState<TableDensity>("comfortable");
  const [ready, setReady] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- sync from localStorage before paint; avoids flash with root layout script */
  useLayoutEffect(() => {
    const d = getStoredTableDensity();
    setDensityState(d);
    try {
      if (d === "compact") {
        document.documentElement.setAttribute("data-table-density", "compact");
      } else {
        document.documentElement.removeAttribute("data-table-density");
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setDensity = useCallback((d: TableDensity) => {
    setDensityState(d);
    setStoredTableDensity(d);
    try {
      if (d === "compact") {
        document.documentElement.setAttribute("data-table-density", "compact");
      } else {
        document.documentElement.removeAttribute("data-table-density");
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    density,
    setDensity,
    ready,
    isCompact: density === "compact",
  };
}

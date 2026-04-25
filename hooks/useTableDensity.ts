"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getStoredTableDensity,
  setStoredTableDensity,
  type TableDensity,
} from "@/lib/tableDensity";

/**
 * Global preference (localStorage) for compact vs comfortable data tables.
 */
export function useTableDensity() {
  const [density, setDensityState] = useState<TableDensity>("comfortable");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDensityState(getStoredTableDensity());
    setReady(true);
  }, []);

  const setDensity = useCallback((d: TableDensity) => {
    setDensityState(d);
    setStoredTableDensity(d);
  }, []);

  return {
    density,
    setDensity,
    ready,
    isCompact: density === "compact",
  };
}

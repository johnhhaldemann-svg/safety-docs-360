"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mergeSearchParam, readAllowedSearchParam } from "@/lib/tabUrlState";

/**
 * Sync a tab value with the URL (`?tab=` by default) for deep links and refresh-safe state.
 */
export function useUrlTabState(
  paramKey: string,
  allowed: readonly string[],
  defaultValue: string
): { value: string; setValue: (next: string) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = useMemo(
    () => readAllowedSearchParam(searchParams, paramKey, allowed, defaultValue),
    [searchParams, paramKey, allowed, defaultValue]
  );

  const setValue = useCallback(
    (next: string) => {
      const safe = allowed.includes(next) ? next : defaultValue;
      const q = mergeSearchParam(searchParams.toString(), paramKey, safe);
      router.replace(`${pathname}${q}`, { scroll: false });
    },
    [router, pathname, searchParams, paramKey, allowed, defaultValue]
  );

  return { value, setValue };
}

/** Max primary tabs enforced by AppTabBar and UX guidelines. */
export const MAX_APP_PRIMARY_TABS = 5;

export function assertMaxPrimaryTabs(count: number, context: string) {
  if (count > MAX_APP_PRIMARY_TABS) {
    throw new Error(`${context}: at most ${MAX_APP_PRIMARY_TABS} primary tabs, got ${count}`);
  }
}

export function readAllowedSearchParam(
  searchParams: { get: (key: string) => string | null },
  key: string,
  allowed: readonly string[],
  fallback: string
): string {
  const raw = searchParams.get(key);
  if (raw && allowed.includes(raw)) {
    return raw;
  }
  return fallback;
}

/** Merge or set one query param; preserves other params. `currentQuery` should be without leading `?`. */
export function mergeSearchParam(currentQuery: string, key: string, value: string): string {
  const params = new URLSearchParams(currentQuery);
  params.set(key, value);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

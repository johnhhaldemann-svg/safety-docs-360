export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function getWithLegacyStorageFallback(
  storage: StorageLike,
  key: string,
  legacyKeys: string[]
) {
  const current = storage.getItem(key);
  if (current !== null) return current;

  for (const legacyKey of legacyKeys) {
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue !== null) {
      storage.setItem(key, legacyValue);
      return legacyValue;
    }
  }

  return null;
}

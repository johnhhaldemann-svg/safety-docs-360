import { describe, expect, it } from "vitest";
import { getWithLegacyStorageFallback, type StorageLike } from "@/lib/localStorageMigration";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  } satisfies StorageLike;
}

describe("getWithLegacyStorageFallback", () => {
  it("copies a legacy value into the active key", () => {
    const storage = memoryStorage({ "old:key": "compact" });

    const value = getWithLegacyStorageFallback(storage, "active:key", ["old:key"]);

    expect(value).toBe("compact");
    expect(storage.getItem("active:key")).toBe("compact");
  });

  it("keeps an existing active value when one exists", () => {
    const storage = memoryStorage({ "active:key": "comfortable", "old:key": "compact" });

    const value = getWithLegacyStorageFallback(storage, "active:key", ["old:key"]);

    expect(value).toBe("comfortable");
    expect(storage.getItem("active:key")).toBe("comfortable");
  });
});

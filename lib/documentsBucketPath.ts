/**
 * Normalizes keys stored in DB so `.download()` matches the object inside the `documents` bucket.
 * Handles full public/sign URLs, accidental `documents/` prefixes, and leading slashes.
 * Safe to import from client or server (pure string logic).
 */
export function normalizeDocumentsBucketObjectPath(objectPath: string): string {
  let p = objectPath.trim();
  if (!p) return p;

  if (p.startsWith("http://") || p.startsWith("https://")) {
    try {
      p = new URL(p).pathname;
    } catch {
      return objectPath.trim();
    }
  }

  const markers = [
    "/storage/v1/object/public/documents/",
    "/storage/v1/object/sign/documents/",
  ];
  for (const m of markers) {
    const i = p.indexOf(m);
    if (i !== -1) {
      p = p.slice(i + m.length);
      break;
    }
  }

  p = p.replace(/^\/+/, "");

  if (p.startsWith("documents/")) {
    p = p.slice("documents/".length);
  }

  return p;
}

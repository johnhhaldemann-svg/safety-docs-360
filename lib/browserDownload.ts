export function parseContentDispositionFilename(value: string | null | undefined) {
  if (!value) return null;

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim() || null;
    } catch {
      // Fall through to the ASCII filename parser.
    }
  }

  const asciiMatch = value.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1]?.trim() || null;
}

export function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
}

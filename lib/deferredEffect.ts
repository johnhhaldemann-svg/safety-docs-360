export function deferEffect(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
}

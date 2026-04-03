/** Client-side fetch with AbortController timeout and non-throwing safe variant for parallel loads. */

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function syntheticJsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** On timeout/network failure, returns a non-OK JSON Response instead of throwing. */
export async function fetchWithTimeoutSafe(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  errorPrefix: string
): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init, timeoutMs);
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return syntheticJsonResponse(
      {
        error: timedOut ? `${errorPrefix} timed out.` : `${errorPrefix} could not be reached.`,
      },
      503
    );
  }
}

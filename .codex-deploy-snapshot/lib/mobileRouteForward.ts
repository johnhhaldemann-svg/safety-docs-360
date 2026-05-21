export function cloneHeadersForInternalApi(request: Request) {
  return {
    Authorization: request.headers.get("authorization") ?? "",
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  };
}

export async function forwardMobileJsonRequest(
  request: Request,
  pathname: string,
  init: RequestInit = {}
) {
  const url = new URL(pathname, request.url);
  const source = new URL(request.url);
  url.search = source.search;
  const method = init.method ?? request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  return fetch(url, {
    method,
    headers: cloneHeadersForInternalApi(request),
    body: hasBody ? await request.text() : undefined,
  });
}

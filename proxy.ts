import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { mapSafePredictOperationHref } from "@/lib/safePredictRouteMap";

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/company-signup",
  "/contractor-training-intake",
  "/demo/load",
  "/liability-waiver",
  "/login",
  "/marketing",
  "/privacy",
  "/reset-password",
  "/terms",
]);

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/cron",
  "/api/contractor-training-intake",
];

const MOBILE_API_CORS_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const MOBILE_API_CORS_HEADERS = "Authorization,Content-Type";

function isPublicPath(pathname: string) {
  return (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function localMobileApiCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  return null;
}

function applyMobileApiCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = localMobileApiCorsOrigin(request);
  if (!origin || !request.nextUrl.pathname.startsWith("/api/mobile")) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", MOBILE_API_CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", MOBILE_API_CORS_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

function shouldRefreshSupabaseSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) {
    return false;
  }
  return hasSupabaseAuthCookie(request);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/mobile") && request.method === "OPTIONS") {
    return applyMobileApiCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  if (!pathname.startsWith("/api") && !isPublicPath(pathname) && !hasSupabaseAuthCookie(request)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const mappedWorkspacePath = mapSafePredictOperationHref(
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  if (mappedWorkspacePath !== `${request.nextUrl.pathname}${request.nextUrl.search}`) {
    const redirectUrl = request.nextUrl.clone();
    const [pathname, search = ""] = mappedWorkspacePath.split("?");
    redirectUrl.pathname = pathname;
    redirectUrl.search = search ? `?${search}` : "";
    return applyMobileApiCorsHeaders(request, NextResponse.redirect(redirectUrl));
  }

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return applyMobileApiCorsHeaders(request, response);
  }

  if (!shouldRefreshSupabaseSession(request)) {
    return applyMobileApiCorsHeaders(request, response);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return applyMobileApiCorsHeaders(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

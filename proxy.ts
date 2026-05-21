import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { mapSafePredictOperationHref } from "@/lib/safePredictRouteMap";

const PUBLIC_PREFIXES = [
  "/",
  "/api/auth",
  "/api/cron",
  "/api/contractor-training-intake",
  "/contractor-training-intake",
  "/company-signup",
  "/demo/load",
  "/liability-waiver",
  "/login",
  "/marketing",
  "/privacy",
  "/safe-predict",
  "/terms",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`)));
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
  const mappedWorkspacePath = mapSafePredictOperationHref(
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  if (mappedWorkspacePath !== `${request.nextUrl.pathname}${request.nextUrl.search}`) {
    const redirectUrl = request.nextUrl.clone();
    const [pathname, search = ""] = mappedWorkspacePath.split("?");
    redirectUrl.pathname = pathname;
    redirectUrl.search = search ? `?${search}` : "";
    return NextResponse.redirect(redirectUrl);
  }

  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api") && !isPublicPath(pathname) && !hasSupabaseAuthCookie(request)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  if (!shouldRefreshSupabaseSession(request)) {
    return response;
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import QRCode from "qrcode";

export const runtime = "nodejs";

// GET /api/company/jobsites/[jobsiteId]/qr
// Returns a PNG QR code image that encodes the public site check-in URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> },
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_field_work", "can_view_dashboards"],
  });
  if ("error" in auth) return auth.error;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "Not linked to a company workspace." }, { status: 400 });
  }

  const { jobsiteId } = await params;

  const { data: jobsite } = await auth.supabase
    .from("jobsites")
    .select("id, name, slug")
    .eq("id", jobsiteId)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();

  if (!jobsite) {
    return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });
  }

  const siteId = (jobsite as { id: string; slug?: string }).slug ?? (jobsite as { id: string }).id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.safetydocs360.com";
  const siteUrl = `${appUrl}/site/${siteId}`;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "png"; // png | svg | dataurl

  if (format === "svg") {
    const svg = await QRCode.toString(siteUrl, { type: "svg", margin: 2, width: 300 });
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="site-qr-${siteId}.svg"`,
      },
    });
  }

  if (format === "dataurl") {
    const dataUrl = await QRCode.toDataURL(siteUrl, { margin: 2, width: 400 });
    return NextResponse.json({ dataUrl, siteUrl });
  }

  // Default: PNG buffer
  const buffer = await QRCode.toBuffer(siteUrl, { margin: 2, width: 400 });
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `attachment; filename="site-qr-${siteId}.png"`,
    },
  });
}

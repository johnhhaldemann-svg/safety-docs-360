import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Marketplace credit purchases are disabled. Use invoice billing instead." },
    { status: 410 }
  );
}

import { NextResponse } from "next/server";
import { OPS_COOKIE, OPS_COOKIE_TTL_SECONDS, opsAdminToken } from "@/lib/ops/auth";

/* Cookie-setting endpoint for the /ops UI. POSTed by the login form;
   on a token match, sets HttpOnly/Secure/SameSite=Strict cookie with
   12h TTL. The middleware reads the same cookie for page-side gating. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = opsAdminToken();
  if (!token) {
    // Middleware should have 404'd before we got here, but be defensive.
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  let body: { token?: string; next?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid-json", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body.token || body.token !== token) {
    return NextResponse.json(
      { error: "unauthorized", message: "Invalid token." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    next: body.next ?? "/ops",
  });
  res.cookies.set(OPS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: OPS_COOKIE_TTL_SECONDS,
  });
  return res;
}

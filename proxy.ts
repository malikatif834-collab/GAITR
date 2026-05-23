import { NextResponse, type NextRequest } from "next/server";
import { OPS_COOKIE } from "@/lib/ops/auth";

/**
 * Edge proxy (renamed from middleware in Next 16) that gates the /ops
 * surface (ADR 0005 D6).
 *
 *   - OPS_ADMIN_TOKEN unset → 404 on every match (the surface doesn't
 *     exist on a deploy that didn't opt in).
 *   - /ops/login + /api/ops/login pass through (the operator needs to
 *     reach the form / endpoint to obtain the cookie).
 *   - /ops/* page requests check the `ops_token` cookie; mismatch
 *     redirects to /ops/login with a `next` param.
 *   - /api/ops/* requests check the `Authorization: Bearer` (or
 *     `x-ops-token`) header; mismatch returns 401.
 */

export const config = {
  matcher: ["/ops", "/ops/:path*", "/api/ops", "/api/ops/:path*"],
};

const LOGIN_PAGE = "/ops/login";
const LOGIN_API = "/api/ops/login";

export function proxy(request: NextRequest) {
  const token = process.env.OPS_ADMIN_TOKEN;
  const { pathname } = request.nextUrl;

  if (!token) {
    return notFound(request);
  }

  // Always allow the login surfaces through.
  if (pathname === LOGIN_PAGE || pathname === LOGIN_API) {
    return NextResponse.next();
  }

  // API paths: bearer-token check.
  if (pathname.startsWith("/api/ops")) {
    const auth = request.headers.get("authorization");
    const xToken = request.headers.get("x-ops-token");
    const provided = auth?.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : (xToken?.trim() ?? undefined);
    if (provided !== token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Page paths: cookie check, redirect to /ops/login on miss.
  const cookie = request.cookies.get(OPS_COOKIE)?.value;
  if (cookie !== token) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PAGE;
    url.search = pathname === "/ops" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

function notFound(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font:14px system-ui;padding:2rem"><h1>404 — Not found</h1></body>`,
    {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

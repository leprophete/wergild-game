import { NextResponse, type NextRequest } from "next/server";

/**
 * Cross-site request guard for every state-changing API call. The session cookie is
 * SameSite=Lax already; this refuses, on top of that, any POST that a browser says comes
 * from another site (Origin / Sec-Fetch-Site). Server-to-server callers (Helius webhook,
 * the reconcile job) send neither header and are authenticated by their own secret.
 */
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  if (SAFE.has(req.method)) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/cron/")) return NextResponse.next();

  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return forbidden();

  const origin = req.headers.get("origin");
  if (origin) {
    const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
    let originHost = "";
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return forbidden();
    }
    if (!host || originHost !== host) return forbidden();
  }
  return NextResponse.next();
}

const forbidden = () => NextResponse.json({ error: "cross_site_request" }, { status: 403 });

export const config = { matcher: "/api/:path*" };

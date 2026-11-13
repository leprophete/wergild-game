import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/** Where the browser may connect: this site, Supabase (REST + Realtime websockets), Solana RPC. */
function connectSources() {
  const out = new Set(["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://*.helius-rpc.com", "https://api.devnet.solana.com", "https://api.mainnet-beta.solana.com"]);
  for (const v of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SOLANA_RPC]) {
    try {
      if (v) out.add(new URL(v).origin);
    } catch {
      /* not a URL */
    }
  }
  if (dev) out.add("ws://localhost:*");
  return [...out].join(" ");
}

const csp = [
  "default-src 'self'",
  // Next.js inlines its bootstrap scripts; dev mode also needs eval for fast refresh
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connectSources()}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // nobody can frame the site to trick a player into signing (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // lets a production build run next to `next dev` without clobbering it: NEXT_DIST_DIR=.next-build next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

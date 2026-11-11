import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a production build run next to `next dev` without clobbering it: NEXT_DIST_DIR=.next-build next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
};

export default nextConfig;

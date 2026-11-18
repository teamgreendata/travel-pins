import type { NextConfig } from "next";

// Static security headers for every route (apps-audit A5, 2026-11-18).
// No Strict-Transport-Security here: Vercel already sends it on *.vercel.app.
// No Content-Security-Policy yet: MapLibre needs `worker-src blob:` and the
// tile/style origins listed first (see BACKLOG.md).
// geolocation=() is deliberate: the map has no "locate me" control. Change it
// to geolocation=(self) in the same commit that adds one, or the browser
// refuses the permission prompt without an error the user can see.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Global security headers — all paths get these.
        // /chat/:path* overrides X-Frame-Options below so the embed widget works.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // Allow /chat pages to be embedded in any origin so embed.js works on
        // nurse practice websites. CSP frame-ancestors overrides X-Frame-Options
        // in modern browsers; we also explicitly remove X-Frame-Options for this
        // path so older browsers don't block the iframe either.
        source: "/chat/:path*",
        headers: [
          { key: "X-Frame-Options", value: "" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;

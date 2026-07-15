/** @type {import('next').NextConfig} */

// Security-заголовки для всех ответов. HSTS браузеры применяют только по HTTPS
// (по HTTP игнорируется — слать безопасно). Referrer-Policy заодно не даёт
// утечь URL с параметрами во внешний Referer.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // не раскрываем "X-Powered-By: Next.js"
  experimental: {
    // mongoose и mongodb-memory-server — серверные пакеты, не бандлить их в клиент
    serverComponentsExternalPackages: ["mongoose", "mongodb-memory-server", "bcryptjs"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

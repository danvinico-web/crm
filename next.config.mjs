/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // mongoose и mongodb-memory-server — серверные пакеты, не бандлить их в клиент
    serverComponentsExternalPackages: ["mongoose", "mongodb-memory-server", "bcryptjs"],
  },
};

export default nextConfig;

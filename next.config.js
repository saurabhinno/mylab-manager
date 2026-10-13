/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Electron / desktop loads via localhost or 127.0.0.1
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

module.exports = nextConfig;

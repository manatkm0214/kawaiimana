/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  generateBuildId: () => null,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
};

export default nextConfig;

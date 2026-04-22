/** @type {import('next').NextConfig} */
const nextConfig = {
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

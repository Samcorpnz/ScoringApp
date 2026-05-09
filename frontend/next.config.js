/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker multi-stage builds
  output: "standalone",
  // Allow loading logos from the relay server
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "**"        },
    ],
  },
};

module.exports = nextConfig;

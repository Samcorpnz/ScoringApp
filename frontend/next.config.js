/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow loading logos from the relay server
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "**"        },
    ],
  },
};

module.exports = nextConfig;

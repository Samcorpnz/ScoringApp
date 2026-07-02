/** @type {import('next').NextConfig} */

// Fail the build early rather than silently deploying a frontend that can't
// reach the relay. NEXT_PUBLIC_ vars are baked in at build time, so an empty
// value here means every user would get a broken connection with no obvious
// error. Local dev is exempt — localhost is a valid target without this var.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_RELAY_URL) {
  throw new Error(
    "NEXT_PUBLIC_RELAY_URL is not set. Add it to your Vercel project's environment variables (e.g. https://scorehub-relay.fly.dev) before deploying."
  );
}

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

export { default } from "next-auth/middleware";

/**
 * Only /control requires a login.
 * /display/* and / are intentionally public so venue screens,
 * OBS, and viewers can connect without authenticating.
 */
export const config = {
  matcher: ["/control/:path*"],
};

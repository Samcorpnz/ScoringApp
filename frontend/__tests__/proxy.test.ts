// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// proxy.ts does `export default auth((req) => {...})` — auth() from "@/auth"
// is NextAuth's higher-order wrapper that supplies `req.auth`. Mock it as an
// identity function so we can invoke the inner callback directly with a
// hand-built req, exercising proxy.ts's own redirect/pass-through logic
// (and its real dependency, lib/authRedirect's loginRedirectUrl).
vi.mock("@/auth", () => ({
  auth: (handler: unknown) => handler,
}));

import middleware, { config } from "../proxy";

describe("proxy middleware", () => {
  it("redirects to /login with a callbackUrl when there is no session", () => {
    const req = {
      auth: null,
      nextUrl: new URL("http://localhost:3000/control"),
    };
    const res = (middleware as (req: unknown) => Response | undefined)(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(307);
    const location = res!.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2Fcontrol");
  });

  it("preserves the requested sub-path in the callbackUrl", () => {
    const req = {
      auth: null,
      nextUrl: new URL("http://localhost:3000/control/mobile"),
    };
    const res = (middleware as (req: unknown) => Response | undefined)(req);
    const location = res!.headers.get("location");
    expect(location).toContain(encodeURIComponent("/control/mobile"));
  });

  it("passes through (returns undefined) when a valid session is present", () => {
    const req = {
      auth: { user: { id: "u1" } },
      nextUrl: new URL("http://localhost:3000/control"),
    };
    const res = (middleware as (req: unknown) => Response | undefined)(req);
    expect(res).toBeUndefined();
  });

  it("redirects when auth exists but has no user", () => {
    const req = {
      auth: {},
      nextUrl: new URL("http://localhost:3000/control"),
    };
    const res = (middleware as (req: unknown) => Response | undefined)(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(307);
  });

  it("matcher config covers /control and its sub-paths", () => {
    expect(config.matcher).toEqual(["/control", "/control/:path*"]);
  });
});

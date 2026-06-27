import { describe, it, expect } from "vitest";
import { loginRedirectUrl } from "../authRedirect";

describe("loginRedirectUrl (SA-4 control-panel server-side auth gate)", () => {
  it("returns null (no redirect) when a session with a user is present", () => {
    const req = {
      auth: { user: { id: "u1" } },
      nextUrl: new URL("http://localhost:3000/control"),
    };
    expect(loginRedirectUrl(req)).toBeNull();
  });

  it("redirects to /login with a callbackUrl when there is no session", () => {
    const req = {
      auth: null,
      nextUrl: new URL("http://localhost:3000/control/mobile"),
    };
    const url = loginRedirectUrl(req);
    expect(url).not.toBeNull();
    expect(url!.pathname).toBe("/login");
    expect(url!.searchParams.get("callbackUrl")).toBe("/control/mobile");
  });

  it("redirects when auth exists but has no user (e.g. a malformed/expired token)", () => {
    const req = {
      auth: {},
      nextUrl: new URL("http://localhost:3000/control"),
    };
    expect(loginRedirectUrl(req)).not.toBeNull();
  });
});

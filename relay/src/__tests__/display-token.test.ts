import { isDisplayTokenValid } from "../server";

// Pure-function coverage of the display-URL lockdown rule (see the
// Match.displayToken schema comment and DISPLAY_TOKEN_REQUIRED in
// server.ts). Route/socket-level wiring is covered by
// data-feed.test.ts and the existing socket-unscoped-viewer.test.ts.
describe("isDisplayTokenValid", () => {
  it("allows any token (even none) when the match has no displayToken yet (pre-backfill)", () => {
    expect(isDisplayTokenValid(null, undefined, true)).toBe(true);
    expect(isDisplayTokenValid(undefined, "whatever", true)).toBe(true);
  });

  it("accepts a matching token regardless of the required flag", () => {
    expect(isDisplayTokenValid("secret-token", "secret-token", false)).toBe(true);
    expect(isDisplayTokenValid("secret-token", "secret-token", true)).toBe(true);
  });

  it("always rejects a wrong token, even in soft (not-required) mode", () => {
    expect(isDisplayTokenValid("secret-token", "wrong-token", false)).toBe(false);
    expect(isDisplayTokenValid("secret-token", "wrong-token", true)).toBe(false);
  });

  it("allows a missing token only when not required (soft rollout mode)", () => {
    expect(isDisplayTokenValid("secret-token", undefined, false)).toBe(true);
  });

  it("rejects a missing token once required", () => {
    expect(isDisplayTokenValid("secret-token", undefined, true)).toBe(false);
  });
});

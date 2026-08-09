// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const getAccountForOrgMock = vi.fn();
vi.mock("@/lib/account", () => ({ getAccountForOrg: (...a: unknown[]) => getAccountForOrgMock(...a) }));

const portalSessionsCreateMock = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    billingPortal: { sessions: { create: (...a: unknown[]) => portalSessionsCreateMock(...a) } },
  }),
}));

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/billing/portal", { method: "POST", headers });
}

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    getAccountForOrgMock.mockReset();
    portalSessionsCreateMock.mockReset();
    delete process.env.NEXTAUTH_URL;
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
  });

  it("401s when there's no session/activeOrgId", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("403s when the caller isn't ADMIN", async () => {
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
    const { POST } = await import("../route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("404s when the account has no Stripe customer on file", async () => {
    getAccountForOrgMock.mockResolvedValue({ id: "acc_1", stripeCustomerId: null });
    const { POST } = await import("../route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("creates a portal session using the request origin and returns its url", async () => {
    getAccountForOrgMock.mockResolvedValue({ id: "acc_1", stripeCustomerId: "cus_1" });
    portalSessionsCreateMock.mockResolvedValue({ url: "https://billing.stripe.com/session_1" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ origin: "https://scorehub.app" }));
    expect(portalSessionsCreateMock).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://scorehub.app/account/billing",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/session_1" });
  });

  it("falls back to NEXTAUTH_URL when there's no origin header", async () => {
    process.env.NEXTAUTH_URL = "https://fallback.example.com";
    getAccountForOrgMock.mockResolvedValue({ id: "acc_1", stripeCustomerId: "cus_1" });
    portalSessionsCreateMock.mockResolvedValue({ url: "https://billing.stripe.com/session_2" });
    const { POST } = await import("../route");
    await POST(makeRequest());
    expect(portalSessionsCreateMock).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://fallback.example.com/account/billing",
    });
  });
});

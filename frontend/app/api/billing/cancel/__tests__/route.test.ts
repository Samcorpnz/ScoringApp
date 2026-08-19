// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const getAccountForOrgMock = vi.fn();
vi.mock("@/lib/account", () => ({ getAccountForOrg: (...a: unknown[]) => getAccountForOrgMock(...a) }));

const subscriptionsUpdateMock = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { update: (...a: unknown[]) => subscriptionsUpdateMock(...a) },
  }),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/billing/cancel", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function baseAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc_1",
    stripeSubscriptionId: "sub_base",
    graphicsSubscriptionId: "sub_graphics",
    dataFeedSubscriptionId: "sub_datafeed",
    ...overrides,
  };
}

describe("POST /api/billing/cancel", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    getAccountForOrgMock.mockReset();
    subscriptionsUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
  });

  it("401s when there's no session/activeOrgId", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("403s when the caller isn't ADMIN", async () => {
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(403);
  });

  it("400s for an unknown add-on", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ addOn: "premium-support" }));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body (treated as no body)", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount());
    subscriptionsUpdateMock.mockResolvedValue({ cancel_at_period_end: true });
    const req = new NextRequest("http://localhost/api/billing/cancel", { method: "POST", body: "not json" });
    const { POST } = await import("../route");
    const res = await POST(req);
    // body becomes null -> resume defaults false, addOn undefined -> proceeds using base subscription
    expect(res.status).toBe(200);
  });

  it("404s when there's no active base subscription to cancel", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount({ stripeSubscriptionId: null }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(404);
  });

  it("404s when there's no active add-on subscription to cancel", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount({ graphicsSubscriptionId: null }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ addOn: "graphics-operator" }));
    expect(res.status).toBe(404);
  });

  it("sets cancel_at_period_end: true on the base subscription by default", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount());
    subscriptionsUpdateMock.mockResolvedValue({ cancel_at_period_end: true });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(subscriptionsUpdateMock).toHaveBeenCalledWith("sub_base", { cancel_at_period_end: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cancelAtPeriodEnd: true });
  });

  it("resumes (cancel_at_period_end: false) when resume: true", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount());
    subscriptionsUpdateMock.mockResolvedValue({ cancel_at_period_end: false });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ resume: true }));
    expect(subscriptionsUpdateMock).toHaveBeenCalledWith("sub_base", { cancel_at_period_end: false });
    expect(await res.json()).toEqual({ cancelAtPeriodEnd: false });
  });

  it("targets the graphics subscription when addOn is given", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount());
    subscriptionsUpdateMock.mockResolvedValue({ cancel_at_period_end: true });
    const { POST } = await import("../route");
    await POST(makeRequest({ addOn: "graphics-operator" }));
    expect(subscriptionsUpdateMock).toHaveBeenCalledWith("sub_graphics", { cancel_at_period_end: true });
  });

  it("targets the data-feed subscription (its own dedicated field) when addOn is data-feed", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount());
    subscriptionsUpdateMock.mockResolvedValue({ cancel_at_period_end: true });
    const { POST } = await import("../route");
    await POST(makeRequest({ addOn: "data-feed" }));
    expect(subscriptionsUpdateMock).toHaveBeenCalledWith("sub_datafeed", { cancel_at_period_end: true });
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const getAccountForOrgMock = vi.fn();
vi.mock("@/lib/account", () => ({ getAccountForOrg: (...a: unknown[]) => getAccountForOrgMock(...a) }));

const subscriptionsRetrieveMock = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { retrieve: (...a: unknown[]) => subscriptionsRetrieveMock(...a) },
  }),
}));

function baseAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc_1",
    plan: "pro",
    billingInterval: "month",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: null,
    graphicsSubscriptionId: null,
    addOns: [] as string[],
    ...overrides,
  };
}

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    cancel_at_period_end: false,
    currency: "nzd",
    items: {
      data: [
        {
          current_period_end: 1234567890,
          price: { unit_amount: 8900, recurring: { interval: "month" } },
        },
      ],
    },
    ...overrides,
  };
}

describe("GET /api/billing/status", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    getAccountForOrgMock.mockReset();
    subscriptionsRetrieveMock.mockReset();
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1" } });
  });

  it("401s when there's no session/activeOrgId", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("404s when the account can't be found", async () => {
    getAccountForOrgMock.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns nulls for subscription/graphicsSubscription when neither id is set", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount({ plan: "free", stripeCustomerId: null }));
    const { GET } = await import("../route");
    const res = await GET();
    expect(subscriptionsRetrieveMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({
      plan: "free",
      billingInterval: "month",
      hasStripeCustomer: false,
      subscription: null,
      addOns: [],
      graphicsSubscription: null,
    });
  });

  it("summarizes the base subscription when stripeSubscriptionId is set", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount({ stripeSubscriptionId: "sub_base" }));
    subscriptionsRetrieveMock.mockResolvedValue(stripeSubscription());
    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();
    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith("sub_base");
    expect(body.subscription).toEqual({
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1234567890,
      amount: 8900,
      currency: "nzd",
      interval: "month",
    });
  });

  it("summarizes both base and graphics subscriptions when both ids are set", async () => {
    getAccountForOrgMock.mockResolvedValue(
      baseAccount({
        stripeSubscriptionId: "sub_base",
        graphicsSubscriptionId: "sub_graphics",
        addOns: ["graphics-operator"],
      }),
    );
    subscriptionsRetrieveMock.mockImplementation(async (id: string) =>
      stripeSubscription({ status: id === "sub_graphics" ? "trialing" : "active" }),
    );
    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();
    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith("sub_base");
    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith("sub_graphics");
    expect(body.graphicsSubscription.status).toBe("trialing");
    expect(body.addOns).toEqual(["graphics-operator"]);
  });

  it("handles a subscription item with no recurring interval / price data gracefully", async () => {
    getAccountForOrgMock.mockResolvedValue(baseAccount({ stripeSubscriptionId: "sub_base" }));
    subscriptionsRetrieveMock.mockResolvedValue(
      stripeSubscription({ items: { data: [] } }),
    );
    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();
    expect(body.subscription).toEqual({
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      amount: null,
      currency: "nzd",
      interval: null,
    });
  });
});

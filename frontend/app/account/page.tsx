"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe-client";
import { Card, SmallBtn } from "../components/primitives";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    tagline: "Get started with one live match",
    features: ["1 live match at a time", "No custom branding"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    monthlyPrice: "$89",
    annualPrice: "$890",
    tagline: "For regular events and clubs",
    features: [
      "Concurrent live matches across your account",
      "Custom team logos",
      "Custom competition logo",
      "Custom sounds",
    ],
  },
  {
    id: "venue" as const,
    name: "Venue",
    monthlyPrice: "$349",
    annualPrice: "$3,490",
    tagline: "For venues running multiple courts at once",
    features: ["Everything in Pro", "Sized for high-volume, multi-court venues"],
  },
];

const GRAPHICS_ADDON = {
  id: "graphics-operator" as const,
  name: "Graphics Operator",
  monthlyPrice: "$29",
  annualPrice: "$290",
  tagline: "Broadcast-style scene graphics for /display, driven from the control panel",
};

type BillingInterval = "month" | "year";

export default function AccountPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.activeRole === "ADMIN";
  type SubscriptionInfo = {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    amount: number | null;
    currency: string | null;
    interval: BillingInterval | null;
  };
  const [billingStatus, setBillingStatus] = useState<{
    plan: string;
    billingInterval: BillingInterval | null;
    hasStripeCustomer: boolean;
    subscription: SubscriptionInfo | null;
    addOns: string[];
    graphicsSubscription: SubscriptionInfo | null;
  } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [checkoutKind, setCheckoutKind] = useState<"plan" | "addOn" | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [graphicsInterval, setGraphicsInterval] = useState<BillingInterval>("month");
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const [finishingUp, setFinishingUp] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [graphicsBusy, setGraphicsBusy] = useState(false);

  const fetchBillingStatus = () =>
    fetch("/api/billing/status")
      .then(r => r.json())
      .then(data => {
        setBillingStatus(data);
        if (data.billingInterval) setBillingInterval(data.billingInterval);
        if (data.graphicsSubscription?.interval) setGraphicsInterval(data.graphicsSubscription.interval);
        return data;
      })
      .catch(() => null);

  const refreshBillingStatus = () => fetchBillingStatus();

  // The webhook that actually updates Account.plan lands asynchronously after
  // Stripe's onComplete fires, so a single fetch right after checkout usually
  // still reads the pre-upgrade plan. Poll briefly until it changes.
  async function waitForPlanChange(previousPlan: string | undefined) {
    setFinishingUp(true);
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 1500));
        const data = await fetchBillingStatus();
        if (data && data.plan !== previousPlan) return;
      }
    } finally {
      setFinishingUp(false);
    }
  }

  // Same polling gap as waitForPlanChange, but for the add-on's own webhook
  // path (checkout.session.completed -> Account.addOns).
  async function waitForAddOnChange(hadAddOn: boolean) {
    setFinishingUp(true);
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 1500));
        const data = await fetchBillingStatus();
        if (data && data.addOns.includes("graphics-operator") !== hadAddOn) return;
      }
    } finally {
      setFinishingUp(false);
    }
  }

  useEffect(() => {
    refreshBillingStatus();
  }, []);

  async function upgrade(plan: "pro" | "venue") {
    setBillingBusy(true);
    setSwitchNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      const data = await res.json().catch(() => null);
      if (data?.clientSecret) {
        setCheckoutKind("plan");
        setCheckoutSecret(data.clientSecret);
      } else if (data?.switched) {
        await refreshBillingStatus();
        setSwitchNotice(`Switched to the ${data.plan} plan.`);
      } else {
        setSwitchNotice(data?.error ?? "couldn't start checkout");
      }
    } finally {
      setBillingBusy(false);
    }
  }

  async function purchaseGraphicsAddOn() {
    setGraphicsBusy(true);
    setSwitchNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOn: "graphics-operator", interval: graphicsInterval }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setCheckoutKind("addOn");
        setCheckoutSecret(data.clientSecret);
      } else if (data.switched) {
        await refreshBillingStatus();
        setSwitchNotice("Switched the Graphics Operator add-on billing interval.");
      } else if (data.error) {
        setSwitchNotice(data.error);
      }
    } finally {
      setGraphicsBusy(false);
    }
  }

  async function setGraphicsCancelAtPeriodEnd(resume: boolean) {
    setGraphicsBusy(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, addOn: "graphics-operator" }),
      });
      if (res.ok) await refreshBillingStatus();
    } finally {
      setGraphicsBusy(false);
    }
  }

  async function manageBilling() {
    setBillingBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) globalThis.location.href = data.url;
    } finally {
      setBillingBusy(false);
    }
  }

  async function setCancelAtPeriodEnd(resume: boolean) {
    setCancelBusy(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      if (res.ok) await refreshBillingStatus();
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="p-6 w-full max-w-5xl mx-auto space-y-6">
      <Card title="Organization">
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {session?.user?.name ?? "—"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
          Role: {session?.user?.activeRole ?? "—"}
        </p>
      </Card>

      <DisplayNameCard initialName={session?.user?.name ?? ""} />
      <PasswordCard />
      <EmailCard currentEmail={session?.user?.email ?? ""} />
      <PasskeysCard />

      {session?.user?.activeOrgId &&
        (session.user.activeRole === "ADMIN" || session.user.activeRole === "MANAGER") && (
          <TeamCard orgId={session.user.activeOrgId} actorRole={session.user.activeRole} actorUserId={session.user.id} />
        )}

      {checkoutSecret ? (
        <Card title="Upgrade">
          <button
            className="text-xs font-bold mb-3"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => setCheckoutSecret(null)}
          >
            ← Back
          </button>
          <EmbeddedCheckoutProvider
            stripe={getStripeClient()}
            options={{
              clientSecret: checkoutSecret,
              onComplete: () => {
                const previousPlan = billingStatus?.plan;
                const hadAddOn = billingStatus?.addOns.includes("graphics-operator") ?? false;
                const kind = checkoutKind;
                setCheckoutSecret(null);
                setCheckoutKind(null);
                if (kind === "addOn") waitForAddOnChange(hadAddOn);
                else waitForPlanChange(previousPlan);
              },
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </Card>
      ) : (
        <Card title="Plan & Billing">
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Free allows one live match at a time and no custom branding. Pro and Venue unlock custom logos/theme and
            concurrent matches across your account.
          </p>
          {!isAdmin && (
            <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
              Only an account ADMIN can change billing.
            </p>
          )}
          {finishingUp && <StatusText message="Finishing up your upgrade…" />}
          {switchNotice && <StatusText message={switchNotice} />}

          {billingStatus && billingStatus.plan !== "free" ? (
            <SubscriptionPanel
              billingStatus={billingStatus}
              billingInterval={billingInterval}
              setBillingInterval={setBillingInterval}
              isAdmin={isAdmin}
              billingBusy={billingBusy}
              cancelBusy={cancelBusy}
              onUpgrade={upgrade}
              onCancel={() => setCancelAtPeriodEnd(false)}
              onResume={() => setCancelAtPeriodEnd(true)}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <SmallBtn label="Monthly" onClick={() => setBillingInterval("month")} active={billingInterval === "month"} />
                <SmallBtn label="Annual (2 months free)" onClick={() => setBillingInterval("year")} active={billingInterval === "year"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLANS.map(plan => {
                  const isCurrentPlan = billingStatus?.plan === plan.id;
                  const isCurrent = isCurrentPlan && (plan.id === "free" || billingStatus?.billingInterval === billingInterval);
                  let priceSuffix: string;
                  if (plan.id === "free") {
                    priceSuffix = "";
                  } else if (billingInterval === "month") {
                    priceSuffix = "/mo";
                  } else {
                    priceSuffix = "/yr";
                  }
                  let planAction: React.ReactNode;
                  if (isCurrent) {
                    planAction = <SmallBtn label="Current plan" onClick={() => {}} active />;
                  } else if (plan.id !== "free" && isAdmin) {
                    planAction = (
                      <SmallBtn
                        label={billingBusy ? "Loading…" : `Upgrade to ${plan.name}`}
                        onClick={() => upgrade(plan.id)}
                        primary
                      />
                    );
                  } else {
                    planAction = null;
                  }
                  return (
                    <div
                      key={plan.id}
                      className="rounded-xl p-4 flex flex-col"
                      style={{
                        background: "var(--bg-elevated)",
                        border: `1px solid ${isCurrent ? "var(--border-accent)" : "var(--border)"}`,
                      }}
                    >
                      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>
                        {plan.name}
                      </p>
                      <p className="mt-2">
                        <span className="text-2xl font-black" style={{ color: "var(--accent)" }}>
                          {billingInterval === "month" ? plan.monthlyPrice : plan.annualPrice}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                          {priceSuffix}
                        </span>
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{plan.tagline}</p>
                      <ul className="text-xs mt-3 space-y-1 flex-1" style={{ color: "var(--text-secondary)" }}>
                        {plan.features.map(f => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                      <div className="mt-4">
                        {planAction}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {isAdmin && billingStatus?.hasStripeCustomer && (
            <div className="mt-4">
              <SmallBtn label={billingBusy ? "Loading…" : "Manage billing"} onClick={manageBilling} />
            </div>
          )}
        </Card>
      )}

      {!checkoutSecret && billingStatus && (
        <GraphicsAddOnCard
          billingStatus={billingStatus}
          isAdmin={isAdmin}
          graphicsInterval={graphicsInterval}
          setGraphicsInterval={setGraphicsInterval}
          graphicsBusy={graphicsBusy}
          onPurchase={purchaseGraphicsAddOn}
          onCancel={() => setGraphicsCancelAtPeriodEnd(false)}
          onResume={() => setGraphicsCancelAtPeriodEnd(true)}
        />
      )}
    </div>
  );
}

function GraphicsAddOnCard({
  billingStatus,
  isAdmin,
  graphicsInterval,
  setGraphicsInterval,
  graphicsBusy,
  onPurchase,
  onCancel,
  onResume,
}: {
  readonly billingStatus: {
    plan: string;
    addOns: string[];
    graphicsSubscription: {
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: number | null;
      amount: number | null;
      currency: string | null;
      interval: BillingInterval | null;
    } | null;
  };
  readonly isAdmin: boolean;
  readonly graphicsInterval: BillingInterval;
  readonly setGraphicsInterval: (interval: BillingInterval) => void;
  readonly graphicsBusy: boolean;
  readonly onPurchase: () => void;
  readonly onCancel: () => void;
  readonly onResume: () => void;
}) {
  const hasBasePlan = billingStatus.plan === "pro" || billingStatus.plan === "venue";
  const isActive = billingStatus.addOns.includes(GRAPHICS_ADDON.id);
  const sub = billingStatus.graphicsSubscription;

  return (
    <Card title="Add-ons">
      {isActive && sub ? (
        <ActiveGraphicsAddOn sub={sub} isAdmin={isAdmin} graphicsBusy={graphicsBusy} onCancel={onCancel} onResume={onResume} />
      ) : (
        <InactiveGraphicsAddOn
          hasBasePlan={hasBasePlan}
          isAdmin={isAdmin}
          graphicsInterval={graphicsInterval}
          setGraphicsInterval={setGraphicsInterval}
          graphicsBusy={graphicsBusy}
          onPurchase={onPurchase}
        />
      )}
    </Card>
  );
}

function ActiveGraphicsAddOn({
  sub, isAdmin, graphicsBusy, onCancel, onResume,
}: {
  readonly sub: NonNullable<{
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    amount: number | null;
    currency: string | null;
    interval: "month" | "year" | null;
  }>;
  readonly isAdmin: boolean;
  readonly graphicsBusy: boolean;
  readonly onCancel: () => void;
  readonly onResume: () => void;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-accent)" }}
    >
      <div>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
          {GRAPHICS_ADDON.name}
        </p>
        <p className="text-lg font-black mt-1" style={{ color: "var(--text-primary)" }}>
          {formatAmount(sub.amount, sub.currency, sub.interval)}
        </p>
        {sub.cancelAtPeriodEnd ? (
          <p className="text-xs mt-1" style={{ color: "var(--danger, #e05252)" }}>
            Cancels on {formatRenewalDate(sub.currentPeriodEnd)}.
          </p>
        ) : (
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Renews {formatRenewalDate(sub.currentPeriodEnd)}
          </p>
        )}
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {sub.cancelAtPeriodEnd ? (
            <SmallBtn label={graphicsBusy ? "Loading…" : "Resume add-on"} onClick={onResume} primary />
          ) : (
            <SmallBtn label={graphicsBusy ? "Loading…" : "Cancel add-on"} onClick={onCancel} />
          )}
        </div>
      )}
    </div>
  );
}

function InactiveGraphicsAddOn({
  hasBasePlan, isAdmin, graphicsInterval, setGraphicsInterval, graphicsBusy, onPurchase,
}: {
  readonly hasBasePlan: boolean;
  readonly isAdmin: boolean;
  readonly graphicsInterval: "month" | "year";
  readonly setGraphicsInterval: (interval: "month" | "year") => void;
  readonly graphicsBusy: boolean;
  readonly onPurchase: () => void;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{GRAPHICS_ADDON.name}</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{GRAPHICS_ADDON.tagline}</p>
        {!hasBasePlan && (
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>Requires a Pro or Venue plan.</p>
        )}
      </div>
      {hasBasePlan && isAdmin && (
        <div className="flex items-center gap-2">
          <SmallBtn label="Monthly" onClick={() => setGraphicsInterval("month")} active={graphicsInterval === "month"} />
          <SmallBtn label="Annual (2 months free)" onClick={() => setGraphicsInterval("year")} active={graphicsInterval === "year"} />
          <span className="text-sm font-black" style={{ color: "var(--accent)" }}>
            {graphicsInterval === "month" ? GRAPHICS_ADDON.monthlyPrice : GRAPHICS_ADDON.annualPrice}
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{graphicsInterval === "month" ? "/mo" : "/yr"}</span>
          </span>
          <SmallBtn label={graphicsBusy ? "Loading…" : "Add Graphics"} onClick={onPurchase} primary />
        </div>
      )}
    </div>
  );
}

function formatRenewalDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatAmount(amount: number | null, currency: string | null, interval: "month" | "year" | null): string {
  if (amount == null || !currency) return "—";
  const value = (amount / 100).toLocaleString(undefined, { style: "currency", currency: currency.toUpperCase() });
  return `${value}/${interval === "year" ? "yr" : "mo"}`;
}

function SubscriptionPanel({
  billingStatus,
  billingInterval,
  setBillingInterval,
  isAdmin,
  billingBusy,
  cancelBusy,
  onUpgrade,
  onCancel,
  onResume,
}: {
  readonly billingStatus: {
    plan: string;
    billingInterval: BillingInterval | null;
    subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null; amount: number | null; currency: string | null } | null;
  };
  readonly billingInterval: BillingInterval;
  readonly setBillingInterval: (interval: BillingInterval) => void;
  readonly isAdmin: boolean;
  readonly billingBusy: boolean;
  readonly cancelBusy: boolean;
  readonly onUpgrade: (plan: "pro" | "venue") => void;
  readonly onCancel: () => void;
  readonly onResume: () => void;
}) {
  const plan = PLANS.find(p => p.id === billingStatus.plan);
  const nextTier = billingStatus.plan === "pro" ? PLANS.find(p => p.id === "venue") : null;
  const sub = billingStatus.subscription;
  const interval = billingStatus.billingInterval ?? "month";

  return (
    <div>
      <div
        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-accent)" }}
      >
        <div>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
            {plan?.name ?? billingStatus.plan} plan
          </p>
          <p className="text-lg font-black mt-1" style={{ color: "var(--text-primary)" }}>
            {formatAmount(sub?.amount ?? null, sub?.currency ?? null, interval)}
          </p>
          {sub?.cancelAtPeriodEnd ? (
            <p className="text-xs mt-1" style={{ color: "var(--danger, #e05252)" }}>
              Cancels on {formatRenewalDate(sub.currentPeriodEnd)} — you&apos;ll move to Free after that.
            </p>
          ) : (
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Renews {formatRenewalDate(sub?.currentPeriodEnd ?? null)}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {sub?.cancelAtPeriodEnd ? (
              <SmallBtn label={cancelBusy ? "Loading…" : "Resume subscription"} onClick={onResume} primary />
            ) : (
              <SmallBtn label={cancelBusy ? "Loading…" : "Downgrade to Free"} onClick={onCancel} />
            )}
          </div>
        )}
      </div>

      {isAdmin && nextTier && !sub?.cancelAtPeriodEnd && (
        <div
          className="rounded-xl p-4 mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Need more capacity? Upgrade to {nextTier.name}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{nextTier.tagline}</p>
          </div>
          <div className="flex items-center gap-2">
            <SmallBtn label="Monthly" onClick={() => setBillingInterval("month")} active={billingInterval === "month"} />
            <SmallBtn label="Annual (2 months free)" onClick={() => setBillingInterval("year")} active={billingInterval === "year"} />
            <SmallBtn
              label={billingBusy ? "Loading…" : `Upgrade to ${nextTier.name}`}
              onClick={() => onUpgrade(nextTier.id as "venue")}
              primary
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Client-side mirror of lib/roles.ts's rank table, used only to decide
// which roles to *offer* in the UI — the API routes are the authoritative
// enforcement, this just avoids showing controls that would 403.
const ROLE_RANK: Record<string, number> = { ADMIN: 3, MANAGER: 2, OPERATOR: 1, VIEWER: 0 };
const ALL_ROLES = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"] as const;

function assignableRoles(actorRole: string): string[] {
  if (actorRole === "ADMIN") return [...ALL_ROLES];
  return ALL_ROLES.filter(r => ROLE_RANK[r] < ROLE_RANK.MANAGER);
}

function canActOnRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === "ADMIN") return true;
  return ROLE_RANK[targetRole] < ROLE_RANK.MANAGER;
}

// email is only present for callers who can manage members (see the members
// API route); lower-privilege roles get names/roles without everyone's email.
type Member = { userId: string; name: string; email?: string; role: string; memberSince: string };
type PendingInvite = { id: string; email: string; role: string; createdAt: string; expiresAt: string };

function TeamCard({ orgId, actorRole, actorUserId }: { readonly orgId: string; readonly actorRole: string; readonly actorUserId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(assignableRoles(actorRole).at(-1) ?? "VIEWER");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  const roleOptions = assignableRoles(actorRole);

  async function refresh() {
    const [membersRes, invitesRes] = await Promise.all([
      fetch(`/api/orgs/${orgId}/members`).then(r => r.json()).catch(() => ({ members: [] })),
      fetch(`/api/orgs/${orgId}/invitations`).then(r => r.json()).catch(() => ({ invitations: [] })),
    ]);
    setMembers(membersRes.members ?? []);
    setInvitations(invitesRes.invitations ?? []);
  }

  useEffect(() => {
    refresh();
  }, [orgId]);

  async function handleInvite() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't send invitation");
      setInviteEmail("");
      setStatus({ message: `Invitation sent to ${inviteEmail}.`, isError: false });
      await refresh();
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    await fetch(`/api/orgs/${orgId}/invitations/${invitationId}`, { method: "DELETE" });
    await refresh();
  }

  async function handleRoleChange(userId: string, role: string) {
    const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus({ message: data?.error ?? "couldn't change role", isError: true });
      return;
    }
    await refresh();
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus({ message: data?.error ?? "couldn't remove member", isError: true });
      return;
    }
    await refresh();
  }

  return (
    <Card title="Team">
      <div className="space-y-2">
        {members.map(m => (
          <div key={m.userId} className="flex items-center justify-between gap-2 py-1">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {m.name}
                {m.email && <span style={{ color: "var(--text-dim)" }}> ({m.email})</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canActOnRole(actorRole, m.role) && m.userId !== actorUserId ? (
                <select
                  className="rounded-lg px-2 py-1 text-xs font-semibold"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  value={m.role}
                  onChange={e => handleRoleChange(m.userId, e.target.value)}
                >
                  {ALL_ROLES.filter(r => r === m.role || roleOptions.includes(r)).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>{m.role}</span>
              )}
              {canActOnRole(actorRole, m.role) && m.userId !== actorUserId && (
                <SmallBtn label="Remove" onClick={() => handleRemove(m.userId)} />
              )}
            </div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-dim)" }}>
            Pending invitations
          </p>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-2">
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {inv.email} — {inv.role}
                </p>
                <SmallBtn label="Revoke" onClick={() => handleRevoke(inv.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-dim)" }}>
          Invite someone
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Email address"
            className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
          />
          <select
            className="rounded-lg px-2 py-2 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
          >
            {roleOptions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <SmallBtn label={busy ? "Sending…" : "Invite"} onClick={handleInvite} primary />
        </div>
        {status && <StatusText message={status.message} isError={status.isError} />}
      </div>
    </Card>
  );
}

function StatusText({ message, isError }: { readonly message: string; readonly isError?: boolean }) {
  return (
    <p className="text-xs mt-2" style={{ color: isError ? "var(--danger)" : "var(--text-secondary)" }}>{message}</p>
  );
}

function DisplayNameCard({ initialName }: { readonly initialName: string }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/account/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't update name");
      setStatus({ message: "Name updated.", isError: false });
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Display Name">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <SmallBtn label={busy ? "Saving…" : "Save"} onClick={handleSave} primary />
      </div>
      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function handleUpdate() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't update password");
      setCurrentPassword("");
      setNewPassword("");
      setStatus({ message: "Password updated.", isError: false });
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Password">
      <div className="space-y-2">
        <input
          type="password"
          placeholder="Current password"
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="New password (min. 8 characters)"
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <SmallBtn label={busy ? "Updating…" : "Update Password"} onClick={handleUpdate} primary />
      </div>
      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}

function EmailCard({ currentEmail }: { readonly currentEmail: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/account/email")
      .then(r => r.json())
      .then(data => setPending(data?.pending ?? null))
      .catch(() => {});
  }, []);

  async function handleSend() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't request email change");
      setPending(data.newEmail);
      setShowForm(false);
      setCurrentPassword("");
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Email Address">
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{currentEmail}</p>

      {pending && (
        <StatusText message={`A verification link was sent to ${pending} — click it to confirm the change.`} />
      )}

      {!pending && !showForm && (
        <div className="mt-3">
          <SmallBtn label="Change email" onClick={() => setShowForm(true)} />
        </div>
      )}

      {!pending && showForm && (
        <div className="space-y-2 mt-3">
          <input
            type="email"
            placeholder="New email address"
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Current password"
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
          <SmallBtn label={busy ? "Sending…" : "Send verification link"} onClick={handleSend} primary />
        </div>
      )}

      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}

type Passkey = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

function PasskeysCard() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/webauthn/passkeys");
      const data = await res.json().catch(() => ({}));
      setPasskeys(Array.isArray(data?.passkeys) ? data.passkeys : []);
    } catch {
      // leave the existing list as-is on a transient fetch failure
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd() {
    setBusy(true);
    setStatus(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");

      const optionsRes = await fetch("/api/webauthn/register/options", { method: "POST" });
      const options = await optionsRes.json().catch(() => ({}));
      if (!optionsRes.ok) throw new Error(options?.error ?? "couldn't start passkey registration");

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(data?.error ?? "couldn't save passkey");

      await refresh();
      setStatus({ message: "Passkey added.", isError: false });
    } catch (e) {
      Sentry.captureException(e);
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/webauthn/passkeys/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't remove passkey");
      await refresh();
      setStatus({ message: "Passkey removed.", isError: false });
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Passkeys">
      {passkeys.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No passkeys yet.</p>
      )}
      {passkeys.length > 0 && (
        <div className="space-y-2">
          {passkeys.map(pk => (
            <div key={pk.id} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {pk.name ?? "Unnamed passkey"} · added {new Date(pk.createdAt).toLocaleDateString()}
              </span>
              <SmallBtn label="Remove" onClick={() => handleRemove(pk.id)} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <SmallBtn label={busy ? "Working…" : "Add a passkey"} onClick={handleAdd} primary />
      </div>
      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}

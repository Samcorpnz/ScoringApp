"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
    monthlyPrice: "$49",
    annualPrice: "$490",
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
    monthlyPrice: "$199",
    annualPrice: "$1,990",
    tagline: "For venues running multiple courts at once",
    features: ["Everything in Pro", "Sized for high-volume, multi-court venues"],
  },
];

export default function AccountPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [billingStatus, setBillingStatus] = useState<{
    plan: string;
    billingInterval: "month" | "year" | null;
    hasStripeCustomer: boolean;
    subscription: {
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: number | null;
      amount: number | null;
      currency: string | null;
    } | null;
  } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const [finishingUp, setFinishingUp] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const fetchBillingStatus = () =>
    fetch("/api/billing/status")
      .then(r => r.json())
      .then(data => {
        setBillingStatus(data);
        if (data.billingInterval) setBillingInterval(data.billingInterval);
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
      const data = await res.json();
      if (data.clientSecret) {
        setCheckoutSecret(data.clientSecret);
      } else if (data.switched) {
        await refreshBillingStatus();
        setSwitchNotice(`Switched to the ${data.plan} plan.`);
      }
    } finally {
      setBillingBusy(false);
    }
  }

  async function manageBilling() {
    setBillingBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
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
          Role: {session?.user?.role ?? "—"}
        </p>
      </Card>

      <DisplayNameCard initialName={session?.user?.name ?? ""} />
      <PasswordCard />
      <EmailCard currentEmail={session?.user?.email ?? ""} />

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
                setCheckoutSecret(null);
                waitForPlanChange(previousPlan);
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
                          {plan.id === "free" ? "" : billingInterval === "month" ? "/mo" : "/yr"}
                        </span>
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{plan.tagline}</p>
                      <ul className="text-xs mt-3 space-y-1 flex-1" style={{ color: "var(--text-secondary)" }}>
                        {plan.features.map(f => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                      <div className="mt-4">
                        {isCurrent ? (
                          <SmallBtn label="Current plan" onClick={() => {}} active />
                        ) : plan.id !== "free" && isAdmin ? (
                          <SmallBtn
                            label={billingBusy ? "Loading…" : `Upgrade to ${plan.name}`}
                            onClick={() => upgrade(plan.id)}
                            primary
                          />
                        ) : null}
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
  billingStatus: {
    plan: string;
    billingInterval: "month" | "year" | null;
    subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null; amount: number | null; currency: string | null } | null;
  };
  billingInterval: "month" | "year";
  setBillingInterval: (interval: "month" | "year") => void;
  isAdmin: boolean;
  billingBusy: boolean;
  cancelBusy: boolean;
  onUpgrade: (plan: "pro" | "venue") => void;
  onCancel: () => void;
  onResume: () => void;
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

function StatusText({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <p className="text-xs mt-2" style={{ color: isError ? "var(--danger)" : "var(--text-secondary)" }}>{message}</p>
  );
}

function DisplayNameCard({ initialName }: { initialName: string }) {
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

function EmailCard({ currentEmail }: { currentEmail: string }) {
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

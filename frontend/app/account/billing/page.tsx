"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe-client";
import { Card, SmallBtn } from "../../components/primitives";

export default function BillingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [status, setStatus] = useState<{ plan: string; hasStripeCustomer: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  const refreshStatus = () => fetch("/api/billing/status").then(r => r.json()).then(setStatus).catch(() => {});

  useEffect(() => {
    refreshStatus();
  }, []);

  async function upgrade(plan: "pro" | "venue") {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.clientSecret) setCheckoutSecret(data.clientSecret);
    } finally {
      setBusy(false);
    }
  }

  async function manageBilling() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  if (checkoutSecret) {
    return (
      <div className="p-6 w-full max-w-4xl mx-auto">
        <EmbeddedCheckoutCard
          clientSecret={checkoutSecret}
          onComplete={() => {
            setCheckoutSecret(null);
            refreshStatus();
          }}
          onClose={() => setCheckoutSecret(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
      <Card title="Current Plan">
        <p className="text-2xl font-black capitalize" style={{ color: "var(--accent)" }}>
          {status?.plan ?? "…"}
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
          Free allows one live match at a time and no custom branding. Pro and Venue unlock custom logos/theme and
          concurrent matches across your account.
        </p>
        {!isAdmin && (
          <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
            Only an account ADMIN can change billing.
          </p>
        )}
      </Card>

      {isAdmin && (
        <Card title="Manage">
          <div className="flex flex-col gap-2">
            <SmallBtn label={busy ? "Loading…" : "Upgrade to Pro"} onClick={() => upgrade("pro")} primary />
            <SmallBtn label={busy ? "Loading…" : "Upgrade to Venue"} onClick={() => upgrade("venue")} />
            {status?.hasStripeCustomer && (
              <SmallBtn label={busy ? "Loading…" : "Manage billing"} onClick={manageBilling} />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function EmbeddedCheckoutCard({ clientSecret, onComplete, onClose }: {
  clientSecret: string; onComplete: () => void; onClose: () => void;
}) {
  return (
    <Card title="Upgrade">
      <button
        className="text-xs font-bold mb-3"
        style={{ color: "var(--text-secondary)" }}
        onClick={onClose}
      >
        ← Back
      </button>
      <EmbeddedCheckoutProvider
        stripe={getStripeClient()}
        options={{ clientSecret, onComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </Card>
  );
}

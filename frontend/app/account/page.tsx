"use client";

import { useSession } from "next-auth/react";
import { Card } from "../components/primitives";

export default function AccountPage() {
  const { data: session } = useSession();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Card title="Organization">
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {session?.user?.name ?? "—"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
          Role: {session?.user?.role ?? "—"}
        </p>
      </Card>
      <Card title="Billing">
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          View your current plan, upgrade, or manage payment details.
        </p>
        <a
          href="/account/billing"
          className="inline-block rounded-lg px-3 py-1.5 text-xs font-bold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", textDecoration: "none" }}
        >
          Go to Billing →
        </a>
      </Card>
    </div>
  );
}

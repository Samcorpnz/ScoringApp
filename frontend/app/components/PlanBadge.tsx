"use client";

import { useEffect, useState } from "react";

export function PlanBadge() {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then(r => r.json())
      .then(data => setPlan(data?.plan ?? null))
      .catch(() => {});
  }, []);

  if (!plan) return null;

  return (
    <a
      href="/account/billing"
      className="text-xs px-2 py-1 rounded font-bold tracking-widest uppercase"
      style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", textDecoration: "none" }}
    >
      {plan}
    </a>
  );
}

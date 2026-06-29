"use client";

import { signOut, useSession } from "next-auth/react";
import { PlanBadge } from "../components/PlanBadge";
import { OrgSwitcher } from "../components/OrgSwitcher";

// This page used to eagerly provision (find-or-create) the org's one LIVE
// match on every load and show its display links directly. Now that orgs
// can have many matches (live, scheduled fixtures, history), there's no
// single match to provision or link to here — that's what /matches is for.
// This page just routes into the hub or straight into setting up a new one.
export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/dashboard";
    },
  });

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="font-black text-lg tracking-tight">
          Score<span style={{ color: "var(--accent)" }}>Hub</span>
        </span>
        <div className="flex items-center gap-4">
          <PlanBadge />
          <OrgSwitcher />
          {session?.user?.name && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{session.user.name}</span>
          )}
          <a
            href="/account"
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Account
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 sm:p-10">
        <h1 className="text-2xl font-black tracking-tight mb-1">Welcome back</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Open your matches hub to score a live game, browse history, or set up something new.
        </p>

        <a
          href="/matches"
          className="block w-full text-center rounded-xl py-3 mb-3 text-sm font-black tracking-widest uppercase"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", textDecoration: "none" }}
        >
          Open Matches →
        </a>

        <a
          href="/setup"
          className="block w-full text-center rounded-xl py-2.5 text-xs font-bold tracking-widest uppercase"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
        >
          Set Up a New Match
        </a>
      </div>
    </div>
  );
}

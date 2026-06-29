"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { PlanBadge } from "../components/PlanBadge";
import { OrgSwitcher } from "../components/OrgSwitcher";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

const DISPLAYS = [
  { path: "/display/fullscreen", title: "Fullscreen", desc: "Second screen / projector / capture card." },
  { path: "/display/basic", title: "Basic", desc: "Clean scoreboard panel for venue screens." },
  { path: "/display/advanced", title: "Advanced", desc: "Full stats with player roster and timeout pips." },
  { path: "/display/overlay", title: "Lower-Third Overlay", desc: "OBS/vMix/Wirecast browser source." },
  { path: "/display/scorebug", title: "Scorebug", desc: "Compact corner widget for streaming." },
] as const;

type ProvisionState = "loading" | "ready" | "upgrade-required" | "error";

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/dashboard";
    },
  });

  const [state, setState] = useState<ProvisionState>("loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const orgId = session?.user?.activeOrgId;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/matches`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 402) {
          setState("upgrade-required");
          setMessage(body?.error ?? "Upgrade required to start a new match.");
        } else if (!res.ok) {
          setState("error");
          setMessage(body?.error ?? "Couldn't set up your match — try again.");
        } else {
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Couldn't reach the scoring service — try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    });
  }

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
        <h1 className="text-2xl font-black tracking-tight mb-1">Your match</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Share a display link or open the control panel to start scoring.
        </p>

        {state === "loading" && (
          <div
            className="rounded-2xl p-6 text-sm"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
          >
            Setting up your match…
          </div>
        )}

        {state === "upgrade-required" && (
          <div
            className="rounded-2xl p-6 text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
          >
            {message}{" "}
            <a href="/account/billing" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              Upgrade plan
            </a>
          </div>
        )}

        {state === "error" && (
          <div
            className="rounded-2xl p-6 text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
          >
            {message}
          </div>
        )}

        {state === "ready" && orgId && (
          <>
            <a
              href="/control"
              className="block w-full text-center rounded-xl py-3 mb-3 text-sm font-black tracking-widest uppercase"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", textDecoration: "none" }}
            >
              Open Control Panel →
            </a>

            <a
              href="/setup"
              className="block w-full text-center rounded-xl py-2.5 mb-6 text-xs font-bold tracking-widest uppercase"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              Set Up a New Match
            </a>

            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--text-dim)" }}>
              Shareable display links
            </p>
            <div className="space-y-3">
              {DISPLAYS.map(d => {
                const url = `${SITE_URL}${d.path}?org=${orgId}`;
                return (
                  <div
                    key={d.path}
                    className="rounded-xl p-4 flex items-center justify-between gap-4"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  >
                    <div>
                      <p className="text-sm font-bold">{d.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-dim)" }}>{d.desc}</p>
                    </div>
                    <button
                      onClick={() => copy(url)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      {copied === url ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

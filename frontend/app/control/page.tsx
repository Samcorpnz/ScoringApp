"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useMatchState } from "../hooks/useMatchState";
import { useControlToken } from "../hooks/useControlToken";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { PlanBadge } from "../components/PlanBadge";
import { OrgSwitcher } from "../components/OrgSwitcher";
import { MatchState } from "../types";
import { useSoundCues, useSoundPlayback } from "../hooks/useSoundCues";
import { ScoreTab } from "./components/ScoreTab";
import { OutputsTab } from "./components/OutputsTab";
import { LogosTab } from "./components/LogosTab";
import { ThemeTab } from "./components/ThemeTab";
import { AudioTab } from "./components/AudioTab";
import { SettingsTab } from "./components/SettingsTab";

type Tab = "score" | "outputs" | "logos" | "theme" | "audio" | "settings";

export default function ControlPanel() {
  return (
    <Suspense fallback={null}>
      <ControlPanelInner />
    </Suspense>
  );
}

function ControlPanelInner() {
  const router = useRouter();
  const matchId = useSearchParams().get("matchId") ?? undefined;
  const controlToken = useControlToken(matchId);
  const { state, status, feedStale, relayUnreachable, sendManualUpdate, sendReset } = useMatchState({ secret: controlToken, role: "control" });
  const { cues, addCue, removeCue } = useSoundCues();
  useSoundPlayback(state, cues);
  // Redirect to login if not authenticated — runs client-side, no Edge Function needed
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/control";
    },
  });
  const [tab, setTab] = useState<Tab>("score");

  const push = (patch: Partial<MatchState>) => sendManualUpdate(patch);

  // Show nothing while checking auth — prevents flash of content
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>Loading…</div>
      </div>
    );
  }

  if (session?.user?.activeRole === "VIEWER") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>
          Your account doesn&apos;t have control access for this organization.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <span className="font-black text-lg tracking-tight">
            Score<span style={{ color: "var(--accent)" }}>Hub</span>
          </span>
          <span className="text-xs px-2 py-1 rounded font-bold tracking-widest uppercase" style={{ background: "var(--bg-elevated)", color: "var(--text-dim)" }}>
            Control
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionBadge status={status} feedStale={feedStale} relayUnreachable={relayUnreachable} />
          <PlanBadge />
          <OrgSwitcher />
          {session?.user?.name && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {session.user.name}
            </span>
          )}
          <a
            href="/account"
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Account
          </a>
          <a
            href="/control/mobile"
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Mobile ↗
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div role="tablist" aria-label="Control panel sections" className="flex px-6 pt-4 gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["score", "outputs", "logos", "theme", "audio", "settings"] as Tab[]).map(t => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`tabpanel-${t}`}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-bold tracking-wide capitalize rounded-t-lg transition-colors"
            style={{
              background: tab === t ? "var(--bg-surface)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6 max-w-5xl" role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "score"    && <ScoreTab    state={state} push={push} sendReset={sendReset} />}
        {tab === "outputs"  && <OutputsTab  />}
        {tab === "logos"    && <LogosTab    state={state} push={push} controlToken={controlToken} />}
        {tab === "theme"    && <ThemeTab    state={state} push={push} controlToken={controlToken} />}
        {tab === "audio"    && <AudioTab    cues={cues} addCue={addCue} removeCue={removeCue} controlToken={controlToken} />}
        {tab === "settings" && (
          <SettingsTab
            state={state}
            push={push}
            matchId={matchId}
            onEnded={() => router.push("/matches")}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SPORT_TEMPLATES, getTemplate } from "../sport-templates";
import { SportType } from "../types";
import { useControlToken } from "../hooks/useControlToken";
import { useMatchState } from "../hooks/useMatchState";

type SetupState = "form" | "provisioning" | "applying" | "upgrade-required" | "error";

export default function SetupPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/setup";
    },
  });
  const orgId = session?.user?.orgId;

  const [sport, setSport] = useState<SportType>("netball");
  const [matchName, setMatchName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [state, setState] = useState<SetupState>("form");
  const [message, setMessage] = useState("");

  const [matchId, setMatchId] = useState<string | null>(null);
  const controlToken = useControlToken(matchId ?? undefined);
  const { state: matchState, status: connStatus, sendManualUpdate } = useMatchState(
    state === "applying" && controlToken ? { secret: controlToken, role: "control" } : undefined
  );

  // Once the socket is connected (only mounted once the form is submitted),
  // push the chosen sport/names and move on — the relay's manualUpdate
  // patch is the only way to set match fields, there's no REST write path.
  useEffect(() => {
    if (state !== "applying" || connStatus !== "connected") return;
    const template = getTemplate(sport);
    sendManualUpdate({
      sport,
      matchName: matchName.trim(),
      clockSeconds: template.clockSeconds,
      countDown: template.countDown,
      period: "1",
      possession: template.defaultPossession,
      home: { ...matchState.home, name: homeName.trim() },
      visitor: { ...matchState.visitor, name: visitorName.trim() },
    });
    router.push(`/control?matchId=${matchId}`);
  }, [state, connStatus]);

  async function handleSubmit() {
    if (!orgId) return;
    setState("provisioning");
    try {
      const res = await fetch(`/api/orgs/${orgId}/matches`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setState("upgrade-required");
        setMessage(body?.error ?? "Upgrade required to start a new match.");
        return;
      }
      if (!res.ok || !body?.id) {
        setState("error");
        setMessage(body?.error ?? "Couldn't set up your match — try again.");
        return;
      }
      setMatchId(body.id);
      setState("applying");
    } catch {
      setState("error");
      setMessage("Couldn't reach the scoring service — try again.");
    }
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
        className="flex items-center px-6 py-4"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="font-black text-lg tracking-tight">
          Score<span style={{ color: "var(--accent)" }}>Hub</span>
        </span>
      </div>

      <div className="max-w-2xl mx-auto p-6 sm:p-10">
        <h1 className="text-2xl font-black tracking-tight mb-1">Set up your match</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Pick a sport and name your teams — you can change any of this later from the Control Panel.
        </p>

        {(state === "provisioning" || state === "applying") && (
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

        {state === "form" && (
          <div className="space-y-6">
            <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--text-dim)" }}>Sport</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SPORT_TEMPLATES.map(t => (
                  <button
                    key={t.sport}
                    className="rounded-lg px-3 py-2 text-left"
                    style={{
                      background: sport === t.sport ? "var(--accent-dim)" : "var(--bg-elevated)",
                      border: `1px solid ${sport === t.sport ? "var(--border-accent)" : "var(--border)"}`,
                      color: sport === t.sport ? "var(--accent)" : "var(--text-secondary)",
                    }}
                    onClick={() => setSport(t.sport)}
                  >
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-xs mt-0.5" style={{ opacity: 0.85 }}>{t.structure}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <SetupField label="Match name" placeholder="e.g. Round 1" value={matchName} onChange={setMatchName} />
              <SetupField label="Home team" placeholder="e.g. Home" value={homeName} onChange={setHomeName} />
              <SetupField label="Visitor team" placeholder="e.g. Visitor" value={visitorName} onChange={setVisitorName} />
            </div>

            <button
              className="w-full rounded-xl py-3 text-sm font-black tracking-widest uppercase"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
              onClick={handleSubmit}
              disabled={!orgId}
            >
              Start Match →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupField({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</p>
      <input
        className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

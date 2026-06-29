"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MatchState } from "../../types";
import { SPORT_TEMPLATES, getTemplate } from "../../sport-templates";
import { RELAY_URL } from "../lib/relay";
import { Card, ColorSwatch, TemplateRow } from "./primitives";

interface BridgeToken {
  id: string;
  label?: string;
  createdAt: string;
  revokedAt: string | null;
}

interface MatchOption {
  id: string;
  homeName: string | null;
  visitorName: string | null;
  status: string;
}

function BridgeTokensCard({ orgId }: { orgId: string }) {
  const [tokens, setTokens] = useState<BridgeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [pinnedMatchId, setPinnedMatchId] = useState("");
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [generating, setGenerating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/matches?status=LIVE,SCHEDULED`)
      .then(res => res.ok ? res.json() : { matches: [] })
      .then(data => setMatches(data.matches || []))
      .catch(() => setMatches([]));
  }, [orgId]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/tokens`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch {
      setError("Failed to load bridge tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTokens(); }, [orgId]);

  const generateToken = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined, matchId: pinnedMatchId || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { token } = await res.json();
      setJustCreated(token);
      setLabel("");
      setPinnedMatchId("");
      await loadTokens();
    } catch {
      setError("Failed to generate token");
    } finally {
      setGenerating(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm("Revoke this bridge token? Any venue laptop using it will lose connection until reconfigured with a new one.")) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/tokens/${tokenId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadTokens();
    } catch {
      setError("Failed to revoke token");
    }
  };

  return (
    <Card title="Bridge Devices">
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        Generate a token for each venue laptop running the bridge app. Paste it into the bridge&apos;s
        connection setup along with the relay URL above.
      </p>

      {justCreated && (
        <div className="mb-3 p-3 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-accent)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>
            Copy this now — it won&apos;t be shown again:
          </p>
          <div className="flex gap-2">
            <code className="text-xs flex-1 p-2 rounded overflow-x-auto" style={{ background: "var(--bg-base)", color: "var(--accent)" }}>
              {justCreated}
            </code>
            <button
              className="rounded-lg px-3 text-xs font-semibold shrink-0"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
              onClick={() => navigator.clipboard.writeText(justCreated)}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Label (e.g. Venue laptop 1)"
          className="flex-1 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <select
          className="rounded-lg px-3 py-2 text-sm shrink-0"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          value={pinnedMatchId}
          onChange={e => setPinnedMatchId(e.target.value)}
        >
          <option value="">All matches</option>
          {matches.map(m => (
            <option key={m.id} value={m.id}>
              {(m.homeName || "Home")} v {(m.visitorName || "Visitor")} ({m.status === "LIVE" ? "live" : "scheduled"})
            </option>
          ))}
        </select>
        <button
          className="rounded-lg px-3 py-2 text-sm font-semibold shrink-0"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={generateToken}
          disabled={generating}
        >
          {generating ? "Generating…" : "Generate Token"}
        </button>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "#EF4444" }}>{error}</p>}

      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>No bridge tokens yet.</p>
      ) : (
        <div className="space-y-1.5">
          {tokens.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded" style={{ background: "var(--bg-elevated)" }}>
              <div>
                <div style={{ color: "var(--text-primary)" }}>{t.label || "Unlabeled"}</div>
                <div style={{ color: "var(--text-dim)" }}>{new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              {t.revokedAt ? (
                <span style={{ color: "var(--text-dim)" }}>Revoked</span>
              ) : (
                <button
                  className="rounded px-2 py-1 shrink-0"
                  style={{ color: "#EF4444", border: "1px solid #EF444433" }}
                  onClick={() => revokeToken(t.id)}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function SettingsTab({ state, push, matchId, onEnded }: {
  state: MatchState;
  push: (p: Partial<MatchState>) => void;
  matchId?: string;
  onEnded?: () => void;
}) {
  const template = getTemplate(state.sport);
  const { data: session } = useSession();
  const orgId = session?.user?.activeOrgId;
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  async function handleEndMatch() {
    if (!orgId || !matchId) return;
    if (!window.confirm("End this match? It will move to History and can't be scored again.")) return;
    setEnding(true);
    setEndError("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/matches/${matchId}/end`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEndError(body?.error ?? "Couldn't end the match — try again.");
        setEnding(false);
        return;
      }
      onEnded?.();
    } catch {
      setEndError("Couldn't reach the server — try again.");
      setEnding(false);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Team colours */}
      <Card title="Home — Team Colour">
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          Used for score text, colour strips, logos, and possession indicators across all displays.
        </p>
        <ColorSwatch color={state.home.color || "#F59E0B"} />
        <input
          type="color"
          className="mt-3 rounded-lg w-full h-10 cursor-pointer"
          style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
          value={state.home.color || "#F59E0B"}
          onChange={e => push({ home: { ...state.home, color: e.target.value } })}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {["#F59E0B", "#EF4444", "#22C55E", "#3B82F6", "#EC4899", "#FFFFFF"].map(c => (
            <button key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: state.home.color === c ? "2px solid white" : "2px solid transparent" }}
              onClick={() => push({ home: { ...state.home, color: c } })} />
          ))}
        </div>
      </Card>

      <Card title="Visitor — Team Colour">
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          Used for score text, colour strips, logos, and possession indicators across all displays.
        </p>
        <ColorSwatch color={state.visitor.color || "#818CF8"} />
        <input
          type="color"
          className="mt-3 rounded-lg w-full h-10 cursor-pointer"
          style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
          value={state.visitor.color || "#818CF8"}
          onChange={e => push({ visitor: { ...state.visitor, color: e.target.value } })}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {["#818CF8", "#8B5CF6", "#06B6D4", "#F97316", "#14B8A6", "#E2E8F0"].map(c => (
            <button key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: state.visitor.color === c ? "2px solid white" : "2px solid transparent" }}
              onClick={() => push({ visitor: { ...state.visitor, color: c } })} />
          ))}
        </div>
      </Card>

      {/* Sport selector */}
      <Card title="Sport">
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Select sport to update display labels and preview match defaults.</p>
        <div className="grid grid-cols-2 gap-2">
          {SPORT_TEMPLATES.map(t => (
            <button key={t.sport}
              className="rounded-lg px-3 py-2 text-left"
              style={{
                background: state.sport === t.sport ? "var(--accent-dim)" : "var(--bg-elevated)",
                border: `1px solid ${state.sport === t.sport ? "var(--border-accent)" : "var(--border)"}`,
                color: state.sport === t.sport ? "var(--accent)" : "var(--text-secondary)",
              }}
              onClick={() => push({ sport: t.sport })}
            >
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-xs mt-0.5" style={{ color: state.sport === t.sport ? "var(--accent)" : "var(--text-dim)", opacity: 0.85 }}>{t.structure}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Template defaults preview */}
      <Card title={`Template Defaults — ${template.label}`}>
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          Applies match structure without resetting scores, team names, or colours.
        </p>
        <div className="space-y-1.5 mb-4">
          <TemplateRow label="Structure" value={template.structure} />
          <TemplateRow label="Clock" value={template.clockSeconds === 0
            ? (template.countDown ? "0:00 (no clock)" : "Counts up from 0:00")
            : `${template.countDown ? "Counts down from" : "Counts up from"} ${Math.floor(template.clockSeconds / 60)}:${String(template.clockSeconds % 60).padStart(2, "0")}`} />
          <TemplateRow label="Timeouts" value={template.timeoutsPerTeam === 0 ? "None" : `${template.timeoutsPerTeam} per team`} />
          <TemplateRow label="Possession" value={template.defaultPossession === "none" ? "Off" : "On"} />
        </div>
        <button
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={() => push({
            sport: template.sport,
            clockSeconds: template.clockSeconds,
            countDown: template.countDown,
            period: "1",
            isRunning: false,
            possession: template.defaultPossession,
            home: { ...state.home, timeouts: template.timeoutsPerTeam, faults: 0 },
            visitor: { ...state.visitor, timeouts: template.timeoutsPerTeam, faults: 0 },
          })}
        >
          Apply Template Defaults
        </button>
      </Card>

      {/* End match */}
      {matchId && (
        <Card title="End Match">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Moves this match to History. Displays connected to it will stop receiving updates.
          </p>
          {endError && (
            <p className="text-xs mb-3 font-semibold" style={{ color: "var(--danger)" }}>{endError}</p>
          )}
          <button
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
            disabled={ending}
            onClick={handleEndMatch}
          >
            {ending ? "Ending…" : "End Match"}
          </button>
        </Card>
      )}

      {/* Connection info */}
      <Card title="Connection">
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Relay server this frontend is connected to.</p>
        <code className="text-xs block p-2 rounded" style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
          {RELAY_URL}
        </code>
        <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
          Change via <code>NEXT_PUBLIC_RELAY_URL</code> in <code>.env.local</code> (frontend) or environment variable on Vercel.
        </p>
      </Card>

      {(session?.user?.activeRole === "ADMIN" || session?.user?.activeRole === "MANAGER") && orgId && (
        <BridgeTokensCard orgId={orgId} />
      )}
    </div>
  );
}

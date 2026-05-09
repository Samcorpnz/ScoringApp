"use client";

import { useState, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useMatchState } from "../hooks/useMatchState";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { MatchState, TeamState, formatClock } from "../types";
import { SPORT_TEMPLATES, getTemplate } from "../sport-templates";

const RELAY_URL      = process.env.NEXT_PUBLIC_RELAY_URL     ?? "http://localhost:4000";
const CONTROL_SECRET = process.env.NEXT_PUBLIC_CONTROL_SECRET ?? "";

type Tab = "score" | "outputs" | "logos" | "settings";

export default function ControlPanel() {
  const { state, status, sendManualUpdate, sendReset } = useMatchState({ secret: CONTROL_SECRET, role: "control" });
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

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <span className="font-black text-lg tracking-tight">
            Score<span style={{ color: "var(--accent)" }}>board</span>
          </span>
          <span className="text-xs px-2 py-1 rounded font-bold tracking-widest uppercase" style={{ background: "var(--bg-elevated)", color: "var(--text-dim)" }}>
            Control
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionBadge status={status} />
          {session?.user?.name && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {session.user.name}
            </span>
          )}
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
      <div className="flex px-6 pt-4 gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["score", "outputs", "logos", "settings"] as Tab[]).map(t => (
          <button
            key={t}
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
      <div className="p-6 max-w-5xl">
        {tab === "score"    && <ScoreTab    state={state} push={push} sendReset={sendReset} />}
        {tab === "outputs"  && <OutputsTab  />}
        {tab === "logos"    && <LogosTab    state={state} push={push} />}
        {tab === "settings" && <SettingsTab state={state} push={push} />}
      </div>
    </div>
  );
}

// ─── Score Tab ────────────────────────────────────────────────────────────────

function ScoreTab({ state, push, sendReset }: {
  state: MatchState;
  push: (p: Partial<MatchState>) => void;
  sendReset: () => void;
}) {
  const [homeName,  setHomeName]  = useState("");
  const [visName,   setVisName]   = useState("");
  const [matchName, setMatchName] = useState("");
  const [period,    setPeriod]    = useState("");

  return (
    <div className="space-y-6">
      {/* Live preview bar */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Live Preview</SectionLabel>
        <div className="flex items-center justify-around mt-4 flex-wrap gap-6">
          <div className="text-center">
            <p className="text-xs mb-1 font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>
              {state.home.name || "HOME"}
            </p>
            <p className="score-digit text-5xl" style={{ color: state.home.color || "var(--home-color)" }}>
              {state.home.score}
            </p>
          </div>
          <div className="text-center">
            <p className="clock-digit text-3xl" style={{ color: state.isRunning ? "#fff" : "var(--text-secondary)" }}>
              {formatClock(state.clockSeconds)}
            </p>
            <p className="text-xs mt-1 font-black tracking-widest" style={{ color: "var(--accent)" }}>QTR {state.period}</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: state.isRunning ? "var(--running)" : "var(--stopped)" }}>
              {state.isRunning ? "● RUNNING" : "■ PAUSED"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs mb-1 font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>
              {state.visitor.name || "VISITOR"}
            </p>
            <p className="score-digit text-5xl" style={{ color: state.visitor.color || "var(--visitor-color)" }}>
              {state.visitor.score}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Home */}
        <Card title={`Home — ${state.home.name || "Home"}`}>
          <NameField label="Team name" value={homeName} placeholder={state.home.name} onChange={setHomeName}
            onCommit={() => { push({ home: { ...state.home, name: homeName } }); setHomeName(""); }} />
          <ScoreButtons score={state.home.score}
            onAdjust={d => push({ home: { ...state.home, score: Math.max(0, state.home.score + d) } })} />
          <div className="flex gap-2 mt-2">
            <SmallBtn label={`Faults: ${state.home.faults}`}
              onClick={() => push({ home: { ...state.home, faults: state.home.faults + 1 } })} />
            <SmallBtn label="Reset faults"
              onClick={() => push({ home: { ...state.home, faults: 0 } })} />
          </div>
        </Card>

        {/* Match */}
        <Card title="Match">
          <NameField label="Match name" value={matchName} placeholder={state.matchName || "e.g. Round 1"}
            onChange={setMatchName} onCommit={() => { push({ matchName }); setMatchName(""); }} />
          <NameField label="Period / Quarter" value={period} placeholder={state.period}
            onChange={setPeriod} onCommit={() => { push({ period }); setPeriod(""); }} />
          <div className="flex flex-wrap gap-2 mt-3">
            <SmallBtn label={state.isRunning ? "⏸ Pause" : "▶ Start"} primary={!state.isRunning}
              onClick={() => push({ isRunning: !state.isRunning })} />
            <SmallBtn label="◀ Home ball" active={state.possession === "home"}
              onClick={() => push({ possession: state.possession === "home" ? "none" : "home" })} />
            <SmallBtn label="Visitor ball ▶" active={state.possession === "visitor"}
              onClick={() => push({ possession: state.possession === "visitor" ? "none" : "visitor" })} />
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button className="w-full rounded-lg py-2 text-sm font-bold tracking-wide uppercase"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
              onClick={() => { if (confirm("Reset scores to 0? (Names and colours are kept)")) sendReset(); }}>
              Reset Match
            </button>
          </div>
        </Card>

        {/* Visitor */}
        <Card title={`Visitor — ${state.visitor.name || "Visitor"}`}>
          <NameField label="Team name" value={visName} placeholder={state.visitor.name} onChange={setVisName}
            onCommit={() => { push({ visitor: { ...state.visitor, name: visName } }); setVisName(""); }} />
          <ScoreButtons score={state.visitor.score}
            onAdjust={d => push({ visitor: { ...state.visitor, score: Math.max(0, state.visitor.score + d) } })} />
          <div className="flex gap-2 mt-2">
            <SmallBtn label={`Faults: ${state.visitor.faults}`}
              onClick={() => push({ visitor: { ...state.visitor, faults: state.visitor.faults + 1 } })} />
            <SmallBtn label="Reset faults"
              onClick={() => push({ visitor: { ...state.visitor, faults: 0 } })} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Outputs Tab ─────────────────────────────────────────────────────────────

const DISPLAYS = [
  {
    href: "/display/fullscreen",
    label: "Fullscreen",
    desc: "Second screen / projector / capture card. Press F to go fullscreen. Layouts: Wide, Stacked, Minimal.",
    tags: ["HDMI", "Capture Card", "Projector"],
    windowSize: "1920,1080",
  },
  {
    href: "/display/basic",
    label: "Basic",
    desc: "Clean scoreboard panel. Good for venue screens and preview monitors.",
    tags: ["Venue Screen", "Preview"],
    windowSize: "1200,400",
  },
  {
    href: "/display/advanced",
    label: "Advanced",
    desc: "Full display with team logos, timeout pips, and on-court player roster.",
    tags: ["Full Stats", "Broadcast Monitor"],
    windowSize: "1400,600",
  },
  {
    href: "/display/overlay",
    label: "Lower-Third Overlay",
    desc: "Transparent background. Add as Browser Source (1920×120) in OBS/vMix/Wirecast.",
    tags: ["OBS", "vMix", "Wirecast", "Transparent"],
    windowSize: "1920,120",
  },
  {
    href: "/display/scorebug",
    label: "Scorebug",
    desc: "Compact corner widget with transparent background. URL params: ?position=tr|tl|br|bl&size=sm|md|lg",
    tags: ["OBS", "vMix", "Corner Widget", "Transparent"],
    windowSize: "480,100",
  },
];

function OutputsTab() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {DISPLAYS.map(d => (
          <div key={d.href} className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{d.label}</span>
                  {d.tags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded font-semibold tracking-wide"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-dim)" }}>
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{d.desc}</p>
                <p className="text-xs mt-2 font-mono" style={{ color: "var(--text-dim)" }}>{origin}{d.href}</p>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  className="rounded-lg px-4 py-2 text-xs font-bold tracking-wide whitespace-nowrap"
                  style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
                  onClick={() => window.open(d.href, `scoreboard-${d.label}`, `width=${d.windowSize.split(",")[0]},height=${d.windowSize.split(",")[1]},menubar=no,toolbar=no,location=no,status=no`)}
                >
                  ↗ Pop Out
                </button>
                <button
                  className="rounded-lg px-4 py-2 text-xs font-bold tracking-wide whitespace-nowrap"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  onClick={() => navigator.clipboard.writeText(`${origin}${d.href}`)}
                >
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Graphics software section */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Graphics Software — Data Feed</SectionLabel>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          For software that drives its own graphics templates (Singular.live, Chyron, Ross Xpression, VIZRT), connect to the live data feed:
        </p>
        <div className="mt-4 space-y-3">
          <DataFeedRow label="REST snapshot" value={`${RELAY_URL}/state`} desc="GET — JSON snapshot of current state, poll at 1–5 Hz" />
          <DataFeedRow label="WebSocket (Socket.io)" value={`${RELAY_URL}`} desc={`Connect with socket.io-client, listen to "matchStateChange" event`} />
          <DataFeedRow
            label="Event name"
            value="matchStateChange"
            desc="Fired on every state change — score, clock, period, possession, logos"
          />
        </div>
        <div className="mt-4 rounded-lg p-3 text-xs font-mono overflow-x-auto"
          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", whiteSpace: "pre" }}>
{`// Example: connect from any JS graphics template
const socket = io("${RELAY_URL}");
socket.on("matchStateChange", (state) => {
  // state.home.name, state.home.score, state.home.color, state.home.logoUrl
  // state.visitor.name, state.visitor.score
  // state.clockSeconds, state.period, state.isRunning
  updateGraphics(state);
});`}
        </div>
      </div>
    </div>
  );
}

function DataFeedRow({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-bold tracking-wide pt-0.5 flex-shrink-0" style={{ color: "var(--text-dim)", minWidth: 180 }}>{label}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono flex-1 min-w-0 truncate" style={{ color: "var(--accent)" }}>{value}</code>
          <button
            className="text-xs rounded px-2 py-0.5 flex-shrink-0"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            onClick={() => navigator.clipboard.writeText(value)}
          >
            Copy
          </button>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Logos Tab ────────────────────────────────────────────────────────────────

function LogosTab({ state, push }: { state: MatchState; push: (p: Partial<MatchState>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <LogoUploader team="home" teamState={state.home} push={push} state={state} />
      <LogoUploader team="visitor" teamState={state.visitor} push={push} state={state} />
    </div>
  );
}

function LogoUploader({ team, teamState, push, state }: {
  team: "home" | "visitor";
  teamState: TeamState;
  push: (p: Partial<MatchState>) => void;
  state: MatchState;
}) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const color = teamState.color || (team === "home" ? "#F59E0B" : "#818CF8");

  const logoSrc = teamState.logoUrl
    ? teamState.logoUrl.startsWith("/logos/") ? `${RELAY_URL}${teamState.logoUrl}` : teamState.logoUrl
    : null;

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${RELAY_URL}/api/logo/${team}`, {
        method: "POST",
        headers: { "x-control-secret": CONTROL_SECRET },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { logoUrl } = await res.json();
      push({ [team]: { ...teamState, logoUrl } } as Partial<MatchState>);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await fetch(`${RELAY_URL}/api/logo/${team}`, {
        method: "DELETE",
        headers: { "x-control-secret": CONTROL_SECRET },
      });
      push({ [team]: { ...teamState, logoUrl: "" } } as Partial<MatchState>);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3">
        <div style={{ width: 4, height: 32, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}` }} />
        <div>
          <SectionLabel>{team === "home" ? "Home" : "Visitor"} Team Logo</SectionLabel>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{teamState.name || team}</p>
        </div>
      </div>

      {/* Preview */}
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          height: 140, background: "var(--bg-elevated)", border: `1px dashed ${logoSrc ? color + "55" : "var(--border)"}`,
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {logoSrc ? (
          <img src={logoSrc} alt={teamState.name} style={{ maxHeight: 110, maxWidth: "80%", objectFit: "contain" }} />
        ) : (
          <div className="text-center">
            <p className="text-2xl mb-1">⬆</p>
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Click or drag to upload</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>PNG, JPG, SVG, WebP — max 5 MB</p>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg py-2 text-sm font-bold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : logoSrc ? "Replace Logo" : "Upload Logo"}
        </button>
        {logoSrc && (
          <button
            className="rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
            onClick={handleRemove}
            disabled={uploading}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────


function SettingsTab({ state, push }: { state: MatchState; push: (p: Partial<MatchState>) => void }) {
  const template = getTemplate(state.sport);
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
    </div>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function TemplateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>{children}</p>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: 32, height: 32, borderRadius: 8, background: color, boxShadow: `0 0 12px ${color}88` }} />
      <code className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>{color}</code>
    </div>
  );
}

function ScoreButtons({ score, onAdjust }: { score: number; onAdjust: (d: number) => void }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      {[-5, -1].map(d => (
        <button key={d} className="rounded-lg px-3 py-2 text-sm font-black flex-1"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onClick={() => onAdjust(d)}>{d}</button>
      ))}
      <div className="flex-1 text-center score-digit text-3xl" style={{ color: "var(--accent)" }}>{score}</div>
      {[1, 5].map(d => (
        <button key={d} className="rounded-lg px-3 py-2 text-sm font-black flex-1"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={() => onAdjust(d)}>+{d}</button>
      ))}
    </div>
  );
}

function NameField({ label, value, placeholder, onChange, onCommit }: {
  label: string; value: string; placeholder: string;
  onChange: (v: string) => void; onCommit: () => void;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</p>
      <div className="flex gap-2">
        <input className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onCommit()} />
        <button className="rounded-lg px-3 py-2 text-xs font-bold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={onCommit}>Set</button>
      </div>
    </div>
  );
}

function SmallBtn({ label, onClick, primary = false, active = false }: {
  label: string; onClick: () => void; primary?: boolean; active?: boolean;
}) {
  return (
    <button className="rounded-lg px-3 py-1.5 text-xs font-bold"
      style={{
        background: active || primary ? "var(--accent-dim)" : "var(--bg-elevated)",
        border: `1px solid ${active || primary ? "var(--border-accent)" : "var(--border)"}`,
        color: active || primary ? "var(--accent)" : "var(--text-secondary)",
      }}
      onClick={onClick}>
      {label}
    </button>
  );
}

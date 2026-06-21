"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useMatchState } from "../hooks/useMatchState";
import { useControlToken } from "../hooks/useControlToken";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { MatchState, TeamState, DisplayTheme, DEFAULT_DISPLAY_THEME, formatClockDisplay } from "../types";
import { useInterpolatedClock } from "../hooks/useInterpolatedClock";
import { SPORT_TEMPLATES, getTemplate } from "../sport-templates";
import { useSoundCues, useSoundPlayback, SoundCue } from "../hooks/useSoundCues";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

type Tab = "score" | "outputs" | "logos" | "theme" | "audio" | "settings";

export default function ControlPanel() {
  const controlToken = useControlToken();
  const { state, status, sendManualUpdate, sendReset } = useMatchState({ secret: controlToken, role: "control" });
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

  if (session?.user?.role === "VIEWER") {
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
          <ConnectionBadge status={status} />
          {session?.user?.name && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {session.user.name}
            </span>
          )}
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
      <div className="flex px-6 pt-4 gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["score", "outputs", "logos", "theme", "audio", "settings"] as Tab[]).map(t => (
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
        {tab === "logos"    && <LogosTab    state={state} push={push} controlToken={controlToken} />}
        {tab === "theme"    && <ThemeTab    state={state} push={push} controlToken={controlToken} />}
        {tab === "audio"    && <AudioTab    cues={cues} addCue={addCue} removeCue={removeCue} controlToken={controlToken} />}
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
  const [homeName,   setHomeName]   = useState("");
  const [visName,    setVisName]    = useState("");
  const [matchName,  setMatchName]  = useState("");
  const [period,     setPeriod]     = useState("");
  const [clockInput, setClockInput] = useState("");
  const displayClock = useInterpolatedClock({ clockSeconds: state.clockSeconds, isRunning: state.isRunning, countDown: state.countDown });

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
              {formatClockDisplay(displayClock)}
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Adjust clock</p>
              <SmallBtn
                label={state.countDown ? "↓ Count down" : "↑ Count up"}
                active={state.countDown}
                onClick={() => push({ countDown: !state.countDown })}
              />
            </div>
            <ClockAdjustButtons
              clockSeconds={state.clockSeconds}
              onAdjust={d => push({ clockSeconds: Math.max(0, state.clockSeconds + d) })}
            />
            <div className="flex gap-2 mt-2">
              <input
                className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
                placeholder="MM:SS"
                value={clockInput}
                onChange={e => setClockInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const s = parseClock(clockInput);
                    if (s !== null) { push({ clockSeconds: s }); setClockInput(""); }
                  }
                }}
              />
              <button
                className="rounded-lg px-3 py-2 text-xs font-bold"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
                onClick={() => {
                  const s = parseClock(clockInput);
                  if (s !== null) { push({ clockSeconds: s }); setClockInput(""); }
                }}
              >Set</button>
            </div>
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

function LogosTab({ state, push, controlToken }: { state: MatchState; push: (p: Partial<MatchState>) => void; controlToken: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <LogoUploader team="home" teamState={state.home} push={push} state={state} controlToken={controlToken} />
      <LogoUploader team="visitor" teamState={state.visitor} push={push} state={state} controlToken={controlToken} />
    </div>
  );
}

function LogoUploader({ team, teamState, push, state, controlToken }: {
  team: "home" | "visitor";
  teamState: TeamState;
  push: (p: Partial<MatchState>) => void;
  state: MatchState;
  controlToken: string;
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
        headers: { "x-control-secret": controlToken },
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
        headers: { "x-control-secret": controlToken },
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
          <div style={{ position: "relative", height: 110, width: "80%" }}>
            <Image src={logoSrc} alt={teamState.name} fill style={{ objectFit: "contain" }} />
          </div>
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

// ─── Theme Tab ────────────────────────────────────────────────────────────────

const FONT_SUGGESTIONS = [
  "Bebas Neue", "Barlow Condensed", "Oswald", "Inter", "Roboto Condensed",
  "Anton", "Rajdhani", "Teko", "Exo 2", "Montserrat",
];

function ThemeTab({ state, push, controlToken }: { state: MatchState; push: (p: Partial<MatchState>) => void; controlToken: string }) {
  const theme: DisplayTheme = state.displayTheme ?? { ...DEFAULT_DISPLAY_THEME };
  const [showFontSuggestions, setShowFontSuggestions] = useState(false);

  const updateTheme = (patch: Partial<DisplayTheme>) =>
    push({ displayTheme: { ...theme, ...patch } });

  const primaryColor = theme.primaryColor || DEFAULT_DISPLAY_THEME.primaryColor;
  const backgroundColor = theme.backgroundColor || DEFAULT_DISPLAY_THEME.backgroundColor;

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Preview</SectionLabel>
        <div
          className="mt-4 rounded-xl flex items-center justify-center gap-8 py-6 px-4"
          style={{ background: backgroundColor, fontFamily: theme.font ? `"${theme.font}", sans-serif` : undefined }}
        >
          {theme.competitionLogoUrl && (
            <div style={{ position: "relative", height: 48, width: 48, flexShrink: 0 }}>
              <Image
                src={theme.competitionLogoUrl.startsWith("/logos/") ? `${RELAY_URL}${theme.competitionLogoUrl}` : theme.competitionLogoUrl}
                alt="Competition logo"
                fill
                style={{ objectFit: "contain" }}
              />
            </div>
          )}
          <div className="text-center">
            <p className="font-black" style={{ color: primaryColor, fontSize: `${2.5 * (theme.textScale ?? 1)}rem`, lineHeight: 1 }}>
              {state.home.score}
            </p>
            <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "#ffffff99" }}>
              {state.home.name || "HOME"}
            </p>
          </div>
          <div className="text-center">
            <p className="font-bold" style={{ color: primaryColor, fontSize: `${1.5 * (theme.textScale ?? 1)}rem` }}>
              {String(Math.floor(state.clockSeconds / 60)).padStart(2, "0")}:{String(state.clockSeconds % 60).padStart(2, "0")}
            </p>
            <p className="text-xs font-black tracking-widest mt-1" style={{ color: primaryColor }}>
              QTR {state.period}
            </p>
          </div>
          <div className="text-center">
            <p className="font-black" style={{ color: primaryColor, fontSize: `${2.5 * (theme.textScale ?? 1)}rem`, lineHeight: 1 }}>
              {state.visitor.score}
            </p>
            <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "#ffffff99" }}>
              {state.visitor.name || "VISITOR"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Primary colour */}
        <Card title="Primary / Accent Colour">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Accent colour for clock, period, scoreboard chrome, and highlights across all displays.
          </p>
          <ColorSwatch color={primaryColor} />
          <input
            type="color"
            className="mt-3 rounded-lg w-full h-10 cursor-pointer"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            value={primaryColor}
            onChange={e => updateTheme({ primaryColor: e.target.value })}
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {["#00C8FF", "#FFFFFF", "#F59E0B", "#22C55E", "#EF4444", "#A855F7", "#EC4899"].map(c => (
              <button key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: primaryColor === c ? "2px solid white" : "2px solid transparent" }}
                onClick={() => updateTheme({ primaryColor: c })} />
            ))}
          </div>
        </Card>

        {/* Background colour */}
        <Card title="Display Background Colour">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Background colour of the scoreboard displays (not the overlay — that stays transparent).
          </p>
          <ColorSwatch color={backgroundColor} />
          <input
            type="color"
            className="mt-3 rounded-lg w-full h-10 cursor-pointer"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            value={backgroundColor}
            onChange={e => updateTheme({ backgroundColor: e.target.value })}
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {["#07090F", "#000000", "#0a0a0a", "#0F172A", "#1E1B4B", "#052e16", "#1a0000"].map(c => (
              <button key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: `2px solid ${backgroundColor === c ? "white" : "#ffffff33"}` }}
                onClick={() => updateTheme({ backgroundColor: c })} />
            ))}
          </div>
        </Card>

        {/* Font */}
        <Card title="Display Font">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Enter any Google Font name. Leave blank to use the default system font.
          </p>
          <div className="relative">
            <input
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              value={theme.font}
              placeholder="e.g. Bebas Neue"
              onChange={e => updateTheme({ font: e.target.value })}
              onFocus={() => setShowFontSuggestions(true)}
              onBlur={() => setTimeout(() => setShowFontSuggestions(false), 150)}
            />
            {showFontSuggestions && (
              <div
                className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
              >
                {FONT_SUGGESTIONS.filter(f => f.toLowerCase().includes(theme.font.toLowerCase())).map(f => (
                  <button
                    key={f}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                    style={{ color: "var(--text-primary)", background: "transparent", display: "block" }}
                    onMouseDown={() => updateTheme({ font: f })}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          {theme.font && (
            <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
              Font loaded from Google Fonts automatically on the display pages.
            </p>
          )}
          {theme.font && (
            <button
              className="mt-2 text-xs"
              style={{ color: "var(--text-dim)" }}
              onClick={() => updateTheme({ font: "" })}
            >
              Clear font
            </button>
          )}
        </Card>

        {/* Text scale */}
        <Card title="Text Scale">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Scale scores and clock text up or down across all displays.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs font-mono w-8 text-right" style={{ color: "var(--text-dim)" }}>0.5×</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={theme.textScale ?? 1}
              className="flex-1"
              onChange={e => updateTheme({ textScale: parseFloat(e.target.value) })}
            />
            <span className="text-xs font-mono w-8" style={{ color: "var(--text-dim)" }}>2×</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <code className="text-sm font-mono font-bold" style={{ color: "var(--accent)" }}>
              {(theme.textScale ?? 1).toFixed(2)}×
            </code>
            <div className="flex gap-2">
              {[0.75, 1, 1.25, 1.5, 1.75].map(s => (
                <button
                  key={s}
                  className="rounded px-2 py-1 text-xs font-bold"
                  style={{
                    background: Math.abs((theme.textScale ?? 1) - s) < 0.01 ? "var(--accent-dim)" : "var(--bg-elevated)",
                    border: `1px solid ${Math.abs((theme.textScale ?? 1) - s) < 0.01 ? "var(--border-accent)" : "var(--border)"}`,
                    color: Math.abs((theme.textScale ?? 1) - s) < 0.01 ? "var(--accent)" : "var(--text-secondary)",
                  }}
                  onClick={() => updateTheme({ textScale: s })}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Competition logo */}
      <CompetitionLogoUploader theme={theme} updateTheme={updateTheme} controlToken={controlToken} />

      {/* Reset */}
      <div className="flex justify-end">
        <button
          className="rounded-lg px-4 py-2 text-sm font-bold"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
          onClick={() => push({ displayTheme: { ...DEFAULT_DISPLAY_THEME } })}
        >
          Reset Theme to Defaults
        </button>
      </div>
    </div>
  );
}

function CompetitionLogoUploader({ theme, updateTheme, controlToken }: {
  theme: DisplayTheme;
  updateTheme: (p: Partial<DisplayTheme>) => void;
  controlToken: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const logoSrc = theme.competitionLogoUrl
    ? theme.competitionLogoUrl.startsWith("/logos/") ? `${RELAY_URL}${theme.competitionLogoUrl}` : theme.competitionLogoUrl
    : null;

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${RELAY_URL}/api/competition-logo`, {
        method: "POST",
        headers: { "x-control-secret": controlToken },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { competitionLogoUrl } = await res.json();
      updateTheme({ competitionLogoUrl });
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await fetch(`${RELAY_URL}/api/competition-logo`, {
        method: "DELETE",
        headers: { "x-control-secret": controlToken },
      });
      updateTheme({ competitionLogoUrl: "" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <SectionLabel>Competition / Event Logo</SectionLabel>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Displayed in the header area of applicable scoreboard outputs. Separate from team logos.
      </p>

      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          height: 140, background: "var(--bg-elevated)",
          border: `1px dashed ${logoSrc ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {logoSrc ? (
          <div style={{ position: "relative", height: 110, width: "60%" }}>
            <Image src={logoSrc} alt="Competition logo" fill style={{ objectFit: "contain" }} />
          </div>
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

// ─── Audio Tab ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "All periods", value: "*" },
  { label: "Period 1",    value: "1" },
  { label: "Period 2",    value: "2" },
  { label: "Period 3",    value: "3" },
  { label: "Period 4",    value: "4" },
  { label: "Extra time",  value: "E" },
];

function AudioTab({ cues, addCue, removeCue, controlToken }: {
  cues: SoundCue[];
  addCue: (cue: SoundCue) => void;
  removeCue: (id: string) => void;
  controlToken: string;
}) {
  const [label,       setLabel]       = useState("");
  const [period,      setPeriod]      = useState("*");
  const [clockInput,  setClockInput]  = useState("");
  const [file,        setFile]        = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    const secs = parseClock(clockInput);
    if (secs === null) { setError("Enter a valid time (MM:SS or seconds)"); return; }
    if (!file)         { setError("Select an audio file"); return; }

    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("sound", file);
      const res = await fetch(`${RELAY_URL}/api/sound`, {
        method: "POST",
        headers: { "x-control-secret": controlToken },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { filename, originalName } = await res.json();
      addCue({
        id:           `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label:        label.trim() || originalName,
        period,
        clockSeconds: secs,
        soundUrl:     `${RELAY_URL}/sounds/${filename}`,
        filename:     originalName,
      });
      setLabel(""); setClockInput(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleTest = (cue: SoundCue) => {
    const audio = new Audio(cue.soundUrl);
    audio.play().catch(() => {});
  };

  const handleRemove = async (cue: SoundCue) => {
    const filename = cue.soundUrl.split("/sounds/")[1];
    if (filename) {
      await fetch(`${RELAY_URL}/api/sound/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: { "x-control-secret": controlToken },
      }).catch(() => {});
    }
    removeCue(cue.id);
  };

  const periodLabel = (p: string) =>
    PERIOD_OPTIONS.find(o => o.value === p)?.label ?? `Period ${p}`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Add cue form */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Add Sound Cue</SectionLabel>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          The selected audio file will play when the clock reaches the specified time during a period.
        </p>

        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Label (optional)</p>
          <input
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            placeholder="e.g. 2-minute warning"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Period</p>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              {PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Clock time (MM:SS)</p>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold font-mono"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              placeholder="02:00"
              value={clockInput}
              onChange={e => setClockInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
          </div>
        </div>

        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Audio file</p>
          <div
            className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
            style={{ background: "var(--bg-elevated)", border: `1px solid ${file ? "var(--border-accent)" : "var(--border)"}` }}
            onClick={() => fileRef.current?.click()}
          >
            <span className="text-base">♪</span>
            <span className="text-sm flex-1 truncate" style={{ color: file ? "var(--text-primary)" : "var(--text-dim)" }}>
              {file ? file.name : "Click to choose an audio file…"}
            </span>
            {file && (
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

        <button
          className="w-full rounded-lg py-2.5 text-sm font-bold tracking-wide"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", opacity: uploading ? 0.6 : 1 }}
          onClick={handleAdd}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Add Cue"}
        </button>
      </div>

      {/* Cue list */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Sound Cues ({cues.length})</SectionLabel>
        {cues.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--text-dim)" }}>
            No cues configured. Add one above.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {[...cues].sort((a, b) => b.clockSeconds - a.clockSeconds).map(cue => (
              <div
                key={cue.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
              >
                <span className="text-base flex-shrink-0" style={{ color: "var(--text-dim)" }}>♪</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{cue.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{cue.filename}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  {periodLabel(cue.period)}
                </span>
                <span
                  className="text-xs font-mono font-bold flex-shrink-0"
                  style={{ color: "var(--accent)", minWidth: 44, textAlign: "right" }}
                >
                  {formatClockDisplay(cue.clockSeconds)}
                </span>
                <button
                  className="rounded px-2 py-1 text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  onClick={() => handleTest(cue)}
                  title="Test this sound"
                >
                  ▶
                </button>
                <button
                  className="rounded px-2 py-1 text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
                  onClick={() => handleRemove(cue)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
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

function parseClock(input: string): number | null {
  const trimmed = input.trim();
  // Accept MM:SS or plain seconds
  const colonMatch = trimmed.match(/^(\d{1,3}):(\d{2})$/);
  if (colonMatch) return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  const seconds = parseInt(trimmed, 10);
  if (!isNaN(seconds) && seconds >= 0) return seconds;
  return null;
}

function ClockAdjustButtons({ clockSeconds, onAdjust }: { clockSeconds: number; onAdjust: (d: number) => void }) {
  const adjustments = [-60, -10, -1, 1, 10, 60];
  return (
    <div className="flex items-center gap-1">
      {adjustments.map(d => (
        <button
          key={d}
          className="rounded-lg py-1.5 text-xs font-black flex-1"
          style={{
            background: d < 0 ? "var(--bg-elevated)" : "var(--accent-dim)",
            border: `1px solid ${d < 0 ? "var(--border)" : "var(--border-accent)"}`,
            color: d < 0 ? "var(--text-secondary)" : "var(--accent)",
          }}
          onClick={() => onAdjust(d)}
        >
          {d > 0 ? "+" : ""}{d < -59 || d > 59 ? `${d / 60}m` : `${d}s`}
        </button>
      ))}
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

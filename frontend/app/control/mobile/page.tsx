"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useMatchState } from "../../hooks/useMatchState";
import { useControlToken } from "../../hooks/useControlToken";
import { ConnectionBadge } from "../../components/ConnectionBadge";
import { MatchState, SportType, formatClock } from "../../types";

// Sport-aware scoring increments
const SCORE_INCREMENTS: Record<SportType, number[]> = {
  netball:      [1],
  basketball:   [1, 2, 3],
  rugby_union:  [3, 5, 7],   // penalty/drop, try, converted try
  rugby_league: [2, 4, 6],   // conversion/penalty, try, try+conv
  volleyball:   [1],
  football:     [1],
  handball:     [1],
  hockey:       [1],
  waterpolo:    [1],
  tennis:       [1],
  custom:       [1, 2, 3],
};

const CLOCK_PRESETS = [5, 8, 10, 12, 15, 20, 25, 30, 40, 45].map(m => ({
  label: `${m}m`,
  secs: m * 60,
}));

export default function MobileControl() {
  const controlToken = useControlToken();
  const { state, status, feedStale, relayUnreachable, sendManualUpdate, sendReset } = useMatchState({
    secret: controlToken,
    role: "control",
  });

  useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/control/mobile";
    },
  });

  // Local clock authority — mobile drives the countdown when no bridge
  const [localClock, setLocalClock]     = useState(0);
  const [isAuthority, setIsAuthority]   = useState(false);
  const [showSetTime, setShowSetTime]   = useState(false);
  const [customMins, setCustomMins]     = useState("");
  const [customSecs, setCustomSecs]     = useState("");

  const clockRef    = useRef(0);         // mirrors localClock for interval reads
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendRef     = useRef(sendManualUpdate);
  sendRef.current   = sendManualUpdate;

  // Sync clock from relay when we're not driving it
  useEffect(() => {
    if (!isAuthority) {
      clockRef.current = state.clockSeconds;
      setLocalClock(state.clockSeconds);
    }
  }, [state.clockSeconds, isAuthority]);

  const stopClock = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsAuthority(false);
    sendRef.current({ isRunning: false });
  };

  const startClock = () => {
    if (intervalRef.current) return;
    setIsAuthority(true);
    sendRef.current({ isRunning: true });
    intervalRef.current = setInterval(() => {
      clockRef.current = Math.max(0, clockRef.current - 1);
      setLocalClock(clockRef.current);
      sendRef.current({ clockSeconds: clockRef.current, isRunning: clockRef.current > 0 });
      if (clockRef.current === 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsAuthority(false);
      }
    }, 1000);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const toggleClock = () => {
    if (isAuthority || state.isRunning) stopClock();
    else startClock();
  };

  const setClockTo = (secs: number) => {
    stopClock();
    clockRef.current = secs;
    setLocalClock(secs);
    sendRef.current({ clockSeconds: secs, isRunning: false });
    setShowSetTime(false);
    setCustomMins("");
    setCustomSecs("");
  };

  const push = (patch: Partial<MatchState>) => sendManualUpdate(patch);
  const clockRunning = isAuthority || state.isRunning;
  const increments   = SCORE_INCREMENTS[state.sport] ?? [1];
  const period       = parseInt(state.period || "1", 10);

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-base)",
      color: "var(--text-primary)",
      overflow: "hidden",
      overscrollBehavior: "none",
      maxWidth: 480,
      margin: "0 auto",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: -0.5 }}>
          Score<span style={{ color: "var(--accent)" }}>Hub</span>
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            textTransform: "uppercase", color: "var(--text-dim)",
          }}>Mobile</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ConnectionBadge status={status} feedStale={feedStale} relayUnreachable={relayUnreachable} />
          <a href="/control" style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none" }}>
            Full panel ↗
          </a>
        </div>
      </div>

      {/* ── Teams + Scores ── */}
      <div style={{ display: "flex", gap: 8, padding: "12px 12px 8px", flexShrink: 0 }}>
        <TeamColumn
          label={state.home.name || "Home"}
          score={state.home.score}
          color={state.home.color || "var(--home-color)"}
          faults={state.home.faults}
          increments={increments}
          onScore={d => push({ home: { ...state.home, score: Math.max(0, state.home.score + d) } })}
          onFault={() => push({ home: { ...state.home, faults: state.home.faults + 1 } })}
        />
        <TeamColumn
          label={state.visitor.name || "Visitor"}
          score={state.visitor.score}
          color={state.visitor.color || "var(--visitor-color)"}
          faults={state.visitor.faults}
          increments={increments}
          onScore={d => push({ visitor: { ...state.visitor, score: Math.max(0, state.visitor.score + d) } })}
          onFault={() => push({ visitor: { ...state.visitor, faults: state.visitor.faults + 1 } })}
        />
      </div>

      {/* ── Clock ── */}
      <div style={{
        margin: "0 12px",
        padding: "12px 16px",
        background: "var(--bg-surface)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {/* Clock face */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div className="clock-digit" style={{
            fontSize: 56,
            color: clockRunning ? "var(--text-primary)" : "var(--text-secondary)",
            lineHeight: 1,
          }}>
            {formatClock(localClock)}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 2,
            textTransform: "uppercase", color: "var(--accent)", marginTop: 4,
          }}>
            {state.sport.replace("_", " ")} · Q{state.period}
          </div>
        </div>

        {/* Start / Stop */}
        <button
          onClick={toggleClock}
          style={{
            width: "100%",
            padding: "15px 0",
            borderRadius: 12,
            border: `1px solid ${clockRunning ? "rgba(239,68,68,0.35)" : "var(--border-accent)"}`,
            background: clockRunning ? "rgba(239,68,68,0.12)" : "var(--accent-dim)",
            color: clockRunning ? "#EF4444" : "var(--accent)",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          {clockRunning ? "■  STOP" : "▶  START"}
        </button>

        {/* Clock control row */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <TinyBtn label={showSetTime ? "▲ Time" : "▼ Time"} onClick={() => setShowSetTime(v => !v)} />
          <TinyBtn
            label={`◀ Q${Math.max(1, period - 1)}`}
            onClick={() => push({ period: String(Math.max(1, period - 1)) })}
          />
          <TinyBtn
            label={`Q${period + 1} ▶`}
            onClick={() => push({ period: String(period + 1) })}
          />
        </div>

        {/* Set-time panel */}
        {showSetTime && (
          <div style={{
            marginTop: 10, padding: 12, borderRadius: 10,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
              {CLOCK_PRESETS.map(p => (
                <button key={p.label} onClick={() => setClockTo(p.secs)} style={{
                  padding: "6px 10px", borderRadius: 7,
                  border: "1px solid var(--border-accent)", background: "var(--accent-dim)",
                  color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number" placeholder="mm" value={customMins}
                onChange={e => setCustomMins(e.target.value)}
                style={{
                  flex: 1, padding: "8px 6px", borderRadius: 8, textAlign: "center",
                  border: "1px solid var(--border)", background: "var(--bg-base)",
                  color: "var(--text-primary)", fontSize: 16, fontWeight: 700,
                }}
              />
              <span style={{ color: "var(--text-dim)", fontWeight: 700 }}>:</span>
              <input
                type="number" placeholder="ss" value={customSecs}
                onChange={e => setCustomSecs(e.target.value)}
                style={{
                  flex: 1, padding: "8px 6px", borderRadius: 8, textAlign: "center",
                  border: "1px solid var(--border)", background: "var(--bg-base)",
                  color: "var(--text-primary)", fontSize: 16, fontWeight: 700,
                }}
              />
              <button
                onClick={() => {
                  const total = (parseInt(customMins || "0", 10) * 60) + parseInt(customSecs || "0", 10);
                  if (total > 0) setClockTo(total);
                }}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--border-accent)", background: "var(--accent-dim)",
                  color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                Set
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Possession ── */}
      <div style={{ padding: "8px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["home", "none", "visitor"] as const).map(p => (
            <button
              key={p}
              onClick={() => push({ possession: p })}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                border: `1px solid ${state.possession === p ? "var(--border-accent)" : "var(--border)"}`,
                background: state.possession === p ? "var(--accent-dim)" : "var(--bg-surface)",
                color: state.possession === p ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {p === "none" ? "—" : p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reset ── */}
      <div style={{ padding: "0 12px 20px", marginTop: "auto", flexShrink: 0 }}>
        <button
          onClick={() => { if (confirm("Reset scores to 0? (Names and colours are kept)")) sendReset(); }}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.05)",
            color: "var(--danger)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Reset Match
        </button>
      </div>
    </div>
  );
}

// ── Team Column ───────────────────────────────────────────────────────────────

function TeamColumn({ label, score, color, faults, increments, onScore, onFault }: {
  label: string;
  score: number;
  color: string;
  faults: number;
  increments: number[];
  onScore: (d: number) => void;
  onFault: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Team name */}
      <div style={{
        textAlign: "center", fontSize: 11, fontWeight: 700,
        letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-dim)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </div>

      {/* Score */}
      <div className="score-digit" style={{ textAlign: "center", fontSize: 72, color, lineHeight: 1 }}>
        {score}
      </div>

      {/* Increment buttons */}
      <div style={{ display: "flex", gap: 5 }}>
        {increments.map(n => (
          <button
            key={n}
            onClick={() => onScore(n)}
            style={{
              flex: 1, padding: "13px 0", borderRadius: 10,
              border: "1px solid var(--border-accent)", background: "var(--accent-dim)",
              color: "var(--accent)", fontSize: 15, fontWeight: 800, cursor: "pointer",
            }}
          >
            +{n}
          </button>
        ))}
      </div>

      {/* Undo / Faults */}
      <div style={{ display: "flex", gap: 5 }}>
        <button
          onClick={() => onScore(-1)}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          −1
        </button>
        <button
          onClick={onFault}
          style={{
            flex: 2, padding: "8px 0", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}
        >
          F: {faults}
        </button>
      </div>
    </div>
  );
}

// ── Tiny Button ───────────────────────────────────────────────────────────────

function TinyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "8px 0", borderRadius: 8,
        border: "1px solid var(--border)", background: "var(--bg-elevated)",
        color: "var(--text-secondary)", fontSize: 11, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { MatchState, formatClockDisplay } from "../../types";
import { useInterpolatedClock } from "../../hooks/useInterpolatedClock";
import { parseClock } from "../lib/parseClock";
import { getTemplate } from "../../sport-templates";
import { ClockAdjustButtons, NameField, ScoreButtons, SectionLabel, SmallBtn } from "./primitives";

export function ScoreTab({ state, push, sendReset }: {
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

  // Keep a stable ref to push/state so keyboard handlers don't go stale
  const stateRef = useRef(state);
  stateRef.current = state;
  const pushRef = useRef(push);
  pushRef.current = push;

  const isNetball = state.sport === "netball";
  const isBasketball = state.sport === "basketball";
  const scoreDelta2 = isNetball ? 2 : 5;
  const faultLabel = isBasketball ? "Fouls" : "Faults";
  const template = getTemplate(state.sport);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't fire while the user is typing in an input or textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = stateRef.current;
      const p = pushRef.current;
      const bball = s.sport === "basketball";
      const delta2 = s.sport === "netball" ? 2 : 5;

      switch (e.key) {
        case " ":
          e.preventDefault();
          p({ isRunning: !s.isRunning });
          break;
        // Home team — left side of keyboard
        case "1":
          p({ home: { ...s.home, score: Math.max(0, s.home.score + 1) } });
          break;
        case "2":
          p({ home: { ...s.home, score: Math.max(0, s.home.score + (bball ? 2 : delta2)) } });
          break;
        case "3":
          if (bball) p({ home: { ...s.home, score: Math.max(0, s.home.score + 3) } });
          break;
        case "q": case "Q":
          p({ home: { ...s.home, score: Math.max(0, s.home.score - 1) } });
          break;
        case "w": case "W":
          p({ home: { ...s.home, score: Math.max(0, s.home.score - (bball ? 2 : delta2)) } });
          break;
        case "e": case "E":
          if (bball) p({ home: { ...s.home, score: Math.max(0, s.home.score - 3) } });
          break;
        // Visitor team — right side of keyboard
        case "8":
          if (bball) p({ visitor: { ...s.visitor, score: Math.max(0, s.visitor.score + 3) } });
          break;
        case "9":
          p({ visitor: { ...s.visitor, score: Math.max(0, s.visitor.score + 1) } });
          break;
        case "0":
          p({ visitor: { ...s.visitor, score: Math.max(0, s.visitor.score + (bball ? 2 : delta2)) } });
          break;
        case "i": case "I":
          if (bball) p({ visitor: { ...s.visitor, score: Math.max(0, s.visitor.score - 3) } });
          break;
        case "o": case "O":
          p({ visitor: { ...s.visitor, score: Math.max(0, s.visitor.score - 1) } });
          break;
        case "p": case "P":
          p({ visitor: { ...s.visitor, score: Math.max(0, s.visitor.score - (bball ? 2 : delta2)) } });
          break;
        // Period
        case "[":
          { const n = parseInt(s.period, 10); p({ period: String(isNaN(n) || n <= 1 ? 1 : n - 1) }); break; }
        case "]":
          { const n = parseInt(s.period, 10); p({ period: String(isNaN(n) ? 2 : n + 1) }); break; }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── PRIMARY OPERATOR CONTROLS ─────────────────────────────── */}

      {/* Start / Stop — full-width, very tall */}
      <button
        className="w-full rounded-2xl py-8 text-3xl font-black tracking-widest uppercase transition-all"
        style={state.isRunning
          ? { background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.5)", color: "var(--danger)" }
          : { background: "var(--accent-dim)", border: "2px solid var(--border-accent)", color: "var(--accent)" }
        }
        onClick={() => push({ isRunning: !state.isRunning })}
      >
        {state.isRunning ? "■  STOP" : "▶  START"}
      </button>

      {/* End Period / Reopen Period */}
      <div className="flex gap-3">
        <button
          className="flex-1 rounded-xl py-4 text-lg font-black tracking-widest uppercase transition-all"
          style={{ background: "rgba(251,146,60,0.1)", border: "2px solid rgba(251,146,60,0.4)", color: "rgb(251,146,60)" }}
          onClick={() => {
            const n = parseInt(state.period, 10);
            const nextPeriod = isNaN(n) ? 2 : n + 1;
            // FIBA: overtime periods are 5 minutes (300s), not 10
            const nextClock = isBasketball && nextPeriod > 4 ? 300 : template.clockSeconds;
            push({
              isRunning: false,
              clockSeconds: nextClock,
              period: String(nextPeriod),
              periodBreak: true,
              // FIBA: team fouls reset each quarter
              ...(isBasketball && {
                home: { ...state.home, faults: 0 },
                visitor: { ...state.visitor, faults: 0 },
              }),
            });
          }}
        >
          ⏭  END {template.periodLabel}
        </button>
        <button
          className="rounded-xl px-5 py-4 text-sm font-black tracking-widest uppercase transition-all"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onClick={() => {
            const n = parseInt(state.period, 10);
            push({
              isRunning: false,
              clockSeconds: template.clockSeconds,
              period: String(isNaN(n) || n <= 1 ? 1 : n - 1),
              periodBreak: false,
            });
          }}
        >
          ↩ REOPEN
        </button>
      </div>

      {/* Live status bar */}
      <div className="rounded-xl p-4 flex items-center justify-around gap-4 flex-wrap"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="text-center">
          <p className="text-xs mb-1 font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>
            {state.home.name || "HOME"}
          </p>
          <p className="score-digit text-5xl" style={{ color: state.home.color || "var(--home-color)" }}>
            {state.home.score}
          </p>
        </div>
        <div className="text-center">
          <p className="clock-digit text-4xl" style={{ color: state.isRunning ? "#fff" : "var(--text-secondary)" }}>
            {formatClockDisplay(displayClock)}
          </p>
          <p className="text-xs mt-1 font-black tracking-widest" style={{ color: state.periodBreak ? "rgb(251,146,60)" : "var(--accent)" }}>
            {state.periodBreak
              ? (template.periodLabel === "HALF" ? "HALF TIME" : `${template.periodLabel} BREAK`)
              : `${template.periodLabel} ${state.period}`}
          </p>
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

      {/* Scoring — two big side-by-side cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-black tracking-widest uppercase mb-1" style={{ color: state.home.color || "var(--home-color)" }}>
            {state.home.name || "Home"}
          </p>
          <ScoreButtons sport={state.sport} score={state.home.score}
            onAdjust={d => push({ home: { ...state.home, score: Math.max(0, state.home.score + d) } })} />
          <div className="flex gap-2 mt-3">
            <SmallBtn label={`${faultLabel}: ${state.home.faults}`}
              onClick={() => push({ home: { ...state.home, faults: state.home.faults + 1 } })} />
            <SmallBtn label={`Reset ${faultLabel.toLowerCase()}`}
              onClick={() => push({ home: { ...state.home, faults: 0 } })} />
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-black tracking-widest uppercase mb-1" style={{ color: state.visitor.color || "var(--visitor-color)" }}>
            {state.visitor.name || "Visitor"}
          </p>
          <ScoreButtons sport={state.sport} score={state.visitor.score}
            onAdjust={d => push({ visitor: { ...state.visitor, score: Math.max(0, state.visitor.score + d) } })} />
          <div className="flex gap-2 mt-3">
            <SmallBtn label={`${faultLabel}: ${state.visitor.faults}`}
              onClick={() => push({ visitor: { ...state.visitor, faults: state.visitor.faults + 1 } })} />
            <SmallBtn label={`Reset ${faultLabel.toLowerCase()}`}
              onClick={() => push({ visitor: { ...state.visitor, faults: 0 } })} />
          </div>
        </div>
      </div>

      {/* Possession */}
      <div className="flex gap-3">
        <button
          className="flex-1 rounded-xl py-3 text-sm font-black tracking-wide"
          style={state.possession === "home"
            ? { background: "var(--accent-dim)", border: "2px solid var(--border-accent)", color: "var(--accent)" }
            : { background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
          }
          onClick={() => push({ possession: state.possession === "home" ? "none" : "home" })}
        >
          ◀ {state.home.name || "Home"} ball
        </button>
        <button
          className="flex-1 rounded-xl py-3 text-sm font-black tracking-wide"
          style={state.possession === "visitor"
            ? { background: "var(--accent-dim)", border: "2px solid var(--border-accent)", color: "var(--accent)" }
            : { background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
          }
          onClick={() => push({ possession: state.possession === "visitor" ? "none" : "visitor" })}
        >
          {state.visitor.name || "Visitor"} ball ▶
        </button>
      </div>

      {/* Keyboard legend */}
      <div className="rounded-xl px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-1"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
        <span className="font-semibold w-full" style={{ color: "var(--text-secondary)" }}>Keyboard shortcuts</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>Space</kbd> Start/Stop</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>1</kbd> Home +1{isBasketball ? " (FT)" : ""}</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>2</kbd> Home +{isBasketball ? "2 (2PT)" : scoreDelta2}</span>
        {isBasketball && <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>3</kbd> Home +3 (3PT)</span>}
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>Q</kbd> Home −1</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>W</kbd> Home −{isBasketball ? 2 : scoreDelta2}</span>
        {isBasketball && <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>E</kbd> Home −3</span>}
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>9</kbd> Visitor +1{isBasketball ? " (FT)" : ""}</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>0</kbd> Visitor +{isBasketball ? "2 (2PT)" : scoreDelta2}</span>
        {isBasketball && <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>8</kbd> Visitor +3 (3PT)</span>}
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>O</kbd> Visitor −1</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>P</kbd> Visitor −{isBasketball ? 2 : scoreDelta2}</span>
        {isBasketball && <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>I</kbd> Visitor −3</span>}
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-elevated)" }}>[</kbd><kbd className="px-1.5 py-0.5 rounded font-mono ml-1" style={{ background: "var(--bg-elevated)" }}>]</kbd> Period −/+</span>
      </div>

      {/* ── SECONDARY CONTROLS ────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 space-y-5"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <SectionLabel>Clock &amp; Match Controls</SectionLabel>

        {/* Clock adjust */}
        <div>
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

        {/* Team names */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <NameField label={`Home team name`} value={homeName} placeholder={state.home.name} onChange={setHomeName}
            onCommit={() => { push({ home: { ...state.home, name: homeName } }); setHomeName(""); }} />
          <NameField label={`Visitor team name`} value={visName} placeholder={state.visitor.name} onChange={setVisName}
            onCommit={() => { push({ visitor: { ...state.visitor, name: visName } }); setVisName(""); }} />
        </div>

        {/* Match info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <NameField label="Match name" value={matchName} placeholder={state.matchName || "e.g. Round 1"}
            onChange={setMatchName} onCommit={() => { push({ matchName }); setMatchName(""); }} />
          <NameField label="Period / Quarter" value={period} placeholder={state.period}
            onChange={setPeriod} onCommit={() => { push({ period }); setPeriod(""); }} />
        </div>

        {/* Reset */}
        <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button className="w-full rounded-lg py-2 text-sm font-bold tracking-wide uppercase"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
            onClick={() => { if (confirm("Reset scores to 0? (Names and colours are kept)")) sendReset(); }}>
            Reset Match
          </button>
        </div>
      </div>
    </div>
  );
}

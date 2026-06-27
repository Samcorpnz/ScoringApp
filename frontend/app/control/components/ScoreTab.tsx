"use client";

import { useState } from "react";
import { MatchState, formatClockDisplay } from "../../types";
import { useInterpolatedClock } from "../../hooks/useInterpolatedClock";
import { parseClock } from "../lib/parseClock";
import { Card, ClockAdjustButtons, NameField, ScoreButtons, SectionLabel, SmallBtn } from "./primitives";

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

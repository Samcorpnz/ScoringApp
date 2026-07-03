"use client";

import { useState } from "react";
import type { ControlPanelProps } from "../../sport-templates";
import type { SoftballFormat, SoftballState } from "../../types";
import { NameField, SectionLabel, SmallBtn } from "./primitives";

const MAX_INNINGS: Record<SoftballFormat, number> = { fastpitch: 7, slowpitch: 6 };
const STARTING_COUNT: Record<SoftballFormat, number> = { fastpitch: 0, slowpitch: 1 };

function getSoftballState(state: ControlPanelProps["state"]): SoftballState {
  const format = ((state.sportConfig?.format as SoftballFormat) ?? "fastpitch");
  const s = state.sportState as SoftballState | undefined;
  const start = STARTING_COUNT[format];
  return {
    sport: "softball",
    format,
    inningHalf: s?.inningHalf ?? "top",
    outs: s?.outs ?? 0,
    balls: s?.balls ?? start,
    strikes: s?.strikes ?? start,
  };
}

export function SoftballTab({ state, push, sendReset, sendUndo }: ControlPanelProps) {
  const [homeName, setHomeName] = useState("");
  const [visName, setVisName] = useState("");
  const [matchName, setMatchName] = useState("");

  const sb = getSoftballState(state);
  const start = STARTING_COUNT[sb.format];
  const maxInnings = MAX_INNINGS[sb.format];
  const inning = parseInt(state.period, 10) || 1;

  const battingSide: "home" | "visitor" = sb.inningHalf === "top" ? "visitor" : "home";

  function pushSoftball(patch: Partial<SoftballState>, extra: Parameters<typeof push>[0] = {}) {
    push({ ...extra, sportState: { ...sb, ...patch } });
  }

  function resetCount() {
    pushSoftball({ balls: start, strikes: start });
  }

  function addBall() {
    if (sb.balls + 1 >= 4) resetCount(); // walk — next batter
    else pushSoftball({ balls: sb.balls + 1 });
  }

  function addStrike() {
    if (sb.strikes + 1 >= 3) recordOut();
    else pushSoftball({ strikes: sb.strikes + 1 });
  }

  function recordOut() {
    const outs = sb.outs + 1;
    if (outs >= 3) endHalfInning();
    else pushSoftball({ outs, balls: start, strikes: start });
  }

  function endHalfInning() {
    if (sb.inningHalf === "top") {
      pushSoftball({ inningHalf: "bottom", outs: 0, balls: start, strikes: start });
    } else {
      pushSoftball(
        { inningHalf: "top", outs: 0, balls: start, strikes: start },
        { period: String(inning + 1) }
      );
    }
  }

  const runDiff = Math.abs(state.home.score - state.visitor.score);
  const mercyEligible = sb.format === "fastpitch" && inning >= 6 && runDiff >= 8;

  return (
    <div className="space-y-6">
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

      <button
        className="w-full rounded-xl py-3 text-sm font-black tracking-widest uppercase"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        onClick={sendUndo}
      >
        ↩ UNDO  <span style={{ fontSize: 10, opacity: 0.6 }}>⌘Z</span>
      </button>

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
          <p className="text-2xl font-black tracking-widest" style={{ color: "var(--accent)" }}>
            {sb.inningHalf === "top" ? "▲" : "▼"} {inning}
          </p>
          <p className="text-xs mt-1 font-black tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>
            {sb.inningHalf === "top" ? "TOP" : "BOTTOM"} of {maxInnings}
          </p>
          {mercyEligible && (
            <p className="text-xs mt-1 font-bold" style={{ color: "rgb(251,146,60)" }}>Mercy rule eligible</p>
          )}
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

      {/* Batter count + outs */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>
          At bat: {battingSide === "home" ? (state.home.name || "Home") : (state.visitor.name || "Visitor")}
        </SectionLabel>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center rounded-xl py-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Balls</p>
            <p className="text-3xl font-black" style={{ color: "var(--accent)" }}>{sb.balls}</p>
          </div>
          <div className="text-center rounded-xl py-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Strikes</p>
            <p className="text-3xl font-black" style={{ color: "var(--accent)" }}>{sb.strikes}</p>
          </div>
          <div className="text-center rounded-xl py-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Outs</p>
            <p className="text-3xl font-black" style={{ color: "var(--danger)" }}>{sb.outs}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-xl py-4 text-lg font-black tracking-widest uppercase"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
            onClick={addBall}>Ball</button>
          <button className="rounded-xl py-4 text-lg font-black tracking-widest uppercase"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
            onClick={addStrike}>Strike</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-xl py-4 text-lg font-black tracking-widest uppercase"
            style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.4)", color: "var(--danger)" }}
            onClick={recordOut}>Out</button>
          <button className="rounded-xl py-4 text-lg font-black tracking-widest uppercase"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onClick={resetCount}>Next Batter</button>
        </div>

        <button className="w-full rounded-xl py-3 text-sm font-black tracking-widest uppercase"
          style={{ background: "rgba(251,146,60,0.1)", border: "2px solid rgba(251,146,60,0.4)", color: "rgb(251,146,60)" }}
          onClick={endHalfInning}>
          ⏭  End Half-Inning
        </button>
      </div>

      {/* Runs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-black tracking-widest uppercase mb-1" style={{ color: state.home.color || "var(--home-color)" }}>
            {state.home.name || "Home"}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button className="rounded-xl py-4 flex-1 text-xl font-black"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => push({ home: { ...state.home, score: Math.max(0, state.home.score - 1) } })}>−1 run</button>
            <button className="rounded-xl py-4 flex-1 text-xl font-black"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
              onClick={() => push({ home: { ...state.home, score: state.home.score + 1 } })}>+1 run</button>
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-black tracking-widest uppercase mb-1" style={{ color: state.visitor.color || "var(--visitor-color)" }}>
            {state.visitor.name || "Visitor"}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button className="rounded-xl py-4 flex-1 text-xl font-black"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => push({ visitor: { ...state.visitor, score: Math.max(0, state.visitor.score - 1) } })}>−1 run</button>
            <button className="rounded-xl py-4 flex-1 text-xl font-black"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
              onClick={() => push({ visitor: { ...state.visitor, score: state.visitor.score + 1 } })}>+1 run</button>
          </div>
        </div>
      </div>

      {/* Secondary controls */}
      <div className="rounded-2xl p-5 space-y-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Match Controls</SectionLabel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NameField label="Home team name" value={homeName} placeholder={state.home.name} onChange={setHomeName}
            onCommit={() => { push({ home: { ...state.home, name: homeName } }); setHomeName(""); }} />
          <NameField label="Visitor team name" value={visName} placeholder={state.visitor.name} onChange={setVisName}
            onCommit={() => { push({ visitor: { ...state.visitor, name: visName } }); setVisName(""); }} />
        </div>

        <div className="grid grid-cols-1 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <NameField label="Match name" value={matchName} placeholder={state.matchName || "e.g. Round 1"}
            onChange={setMatchName} onCommit={() => { push({ matchName }); setMatchName(""); }} />
        </div>

        <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <SmallBtn label={`Format: ${sb.format}`} onClick={() => {}} />
        </div>

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

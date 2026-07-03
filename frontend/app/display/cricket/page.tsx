"use client";

import { useMatchState } from "../../hooks/useMatchState";
import { useDisplayTheme } from "../../hooks/useDisplayTheme";
import { ConnectionBadge } from "../../components/ConnectionBadge";
import type { CricketFormat, CricketState } from "../../types";

const OVERS_PER_INNINGS: Record<CricketFormat, number> = { t20: 20, odi: 50, test: 90 };

function getCricketState(sportState: unknown): CricketState | undefined {
  const cs = sportState as CricketState | undefined;
  return cs?.sport === "cricket" ? cs : undefined;
}

export default function CricketDisplay() {
  const { state, status, relayUnreachable } = useMatchState();
  const { textScale: _textScale, competitionLogoUrl: _cl, ...themeStyle } = useDisplayTheme(state.displayTheme);
  const cricket = getCricketState(state.sportState);

  if (!cricket) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={themeStyle}>
        <p style={{ color: "var(--text-dim)" }}>Waiting for cricket match data…</p>
      </div>
    );
  }

  const inn = cricket.innings[cricket.innings.length - 1];
  const battingTeam = state[inn.battingTeam];
  const bowlingTeam = state[inn.battingTeam === "home" ? "visitor" : "home"];
  const batter1 = inn.batters[inn.currentBatter1Index];
  const batter2 = inn.batters[inn.currentBatter2Index];
  const bowler = inn.bowlers[inn.currentBowlerIndex];

  const ballsBowled = inn.oversComplete * 6 + inn.ballsThisOver;
  const crr = ballsBowled > 0 ? (inn.runs / (ballsBowled / 6)).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={themeStyle}>
      <div className="fixed top-4 right-4 z-10">
        <ConnectionBadge status={status} relayUnreachable={relayUnreachable} />
      </div>

      {state.matchName && (
        <p className="mb-4 uppercase tracking-widest font-semibold" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          {state.matchName}
        </p>
      )}

      <div
        className="w-full max-w-4xl rounded-2xl overflow-hidden p-8"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 0 60px rgba(0,0,0,0.6)" }}
      >
        {/* Score header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "var(--text-dim)" }}>
              {battingTeam.name || inn.battingTeam} batting · {cricket.format.toUpperCase()} · Innings {cricket.inningsNumber}
            </p>
            <p className="score-digit" style={{ fontSize: "4rem", lineHeight: 1, color: "var(--accent)" }}>
              {inn.runs}/{inn.wickets}
              <span style={{ fontSize: "2rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
                ({inn.oversComplete}.{inn.ballsThisOver} ov)
              </span>
            </p>
          </div>
          <div className="text-right">
            {inn.freeHit ? (
              <p className="font-black tracking-widest uppercase" style={{ fontSize: "1.25rem", color: "var(--danger)" }}>⚡ Free Hit</p>
            ) : (
              <>
                <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "var(--text-dim)" }}>CRR</p>
                <p style={{ fontSize: "1.75rem", color: "var(--text-primary)" }}>{crr}</p>
              </>
            )}
          </div>
        </div>

        {/* Target / RRR */}
        {inn.target !== undefined && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center justify-between"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm font-bold" style={{ color: "rgb(251,146,60)" }}>
              Target {inn.target} · need {Math.max(0, inn.target - inn.runs)} runs
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              RRR {(() => {
                const ballsLeft = Math.max(0, 6 * OVERS_PER_INNINGS[cricket.format] - ballsBowled);
                return ballsLeft > 0 ? ((Math.max(0, inn.target - inn.runs)) / (ballsLeft / 6)).toFixed(2) : "—";
              })()}
            </p>
          </div>
        )}

        {/* Batsmen + bowler */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: "var(--text-dim)" }}>Batting</p>
            {[batter1, batter2].map((b, i) => b && (
              <div key={b.playerId} className="flex justify-between text-sm py-1">
                <span style={{ color: i === 0 ? "var(--accent)" : "var(--text-secondary)" }}>{b.name}{i === 0 ? " *" : ""}</span>
                <span style={{ color: "var(--text-primary)" }}>{b.runs} ({b.ballsFaced}) · {b.fours}×4 {b.sixes}×6</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: "var(--text-dim)" }}>Bowling</p>
            {bowler && (
              <div className="flex justify-between text-sm py-1">
                <span style={{ color: "var(--text-secondary)" }}>{bowler.name}</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {bowler.overs}.{bowler.ballsThisOver}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}
                </span>
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>{bowlingTeam.name || "Bowling side"}</p>
          </div>
        </div>

        {/* Last over */}
        <div>
          <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: "var(--text-dim)" }}>This over</p>
          <div className="flex gap-2 flex-wrap">
            {inn.thisOverBalls.length ? inn.thisOverBalls.map((b, i) => (
              <span
                key={i}
                className="rounded-lg px-3 py-1.5 text-sm font-bold"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {b}
              </span>
            )) : <span className="text-sm" style={{ color: "var(--text-dim)" }}>—</span>}
          </div>
        </div>
      </div>

      {state.inputSource !== "none" && (
        <p className="mt-6 text-xs" style={{ color: "var(--text-dim)" }}>Source: {state.inputSource}</p>
      )}
    </div>
  );
}

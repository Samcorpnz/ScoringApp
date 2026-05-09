"use client";

import { useMatchState } from "../../hooks/useMatchState";
import { ScorePanel } from "../../components/ScorePanel";
import { ClockPanel } from "../../components/ClockPanel";
import { ConnectionBadge } from "../../components/ConnectionBadge";

export default function BasicDisplay() {
  const { state, status } = useMatchState();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Connection badge — top right */}
      <div className="fixed top-4 right-4 z-10">
        <ConnectionBadge status={status} />
      </div>

      {/* Match name */}
      {state.matchName && (
        <p
          className="mb-8 uppercase tracking-widest font-semibold"
          style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}
        >
          {state.matchName}
        </p>
      )}

      {/* Main scoreboard */}
      <div
        className="relative flex items-center gap-0 w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 0 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Home strip accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: "var(--home-color)" }}
        />
        {/* Visitor strip accent */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1"
          style={{ background: "var(--visitor-color)" }}
        />

        {/* Home team */}
        <div className="flex-1 flex justify-center py-10 pl-8">
          <ScorePanel team={state.home} side="home" possession={state.possession} />
        </div>

        {/* Divider + clock */}
        <div
          className="flex flex-col items-center px-8 py-10"
          style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}
        >
          <ClockPanel
            clockSeconds={state.clockSeconds}
            countDown={state.countDown}
            period={state.period}
            isRunning={state.isRunning}
            hornActive={state.hornActive}
            matchName={state.matchName}
          />
        </div>

        {/* Visitor team */}
        <div className="flex-1 flex justify-center py-10 pr-8">
          <ScorePanel team={state.visitor} side="visitor" possession={state.possession} />
        </div>
      </div>

      {/* Input source */}
      {state.inputSource !== "none" && (
        <p className="mt-6 text-xs" style={{ color: "var(--text-dim)" }}>
          Source: {state.inputSource}
        </p>
      )}
    </div>
  );
}

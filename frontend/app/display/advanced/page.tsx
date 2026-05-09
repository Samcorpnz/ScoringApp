"use client";

import { useMatchState } from "../../hooks/useMatchState";
import { ScorePanel } from "../../components/ScorePanel";
import { ClockPanel } from "../../components/ClockPanel";
import { ConnectionBadge } from "../../components/ConnectionBadge";
import { TeamState, Possession } from "../../types";

export default function AdvancedDisplay() {
  const { state, status } = useMatchState();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="fixed top-4 right-4 z-10">
        <ConnectionBadge status={status} />
      </div>

      <div
        className="w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 0 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header bar */}
        <div
          className="px-8 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}
        >
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>
            {state.matchName || "SCOREBOARD"}
          </span>
          <ConnectionBadge status={status} />
        </div>

        {/* Main content */}
        <div className="flex items-stretch">
          {/* Home */}
          <TeamColumn team={state.home} side="home" possession={state.possession} />

          {/* Center clock */}
          <div
            className="flex flex-col items-center justify-center px-10 py-8 flex-shrink-0"
            style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}
          >
            <ClockPanel
              clockSeconds={state.clockSeconds}
              countDown={state.countDown}
              period={state.period}
              isRunning={state.isRunning}
              hornActive={state.hornActive}
            />
          </div>

          {/* Visitor */}
          <TeamColumn team={state.visitor} side="visitor" possession={state.possession} />
        </div>

        {/* Player roster strip */}
        <PlayerStrip homeTeam={state.home} visitorTeam={state.visitor} />
      </div>
    </div>
  );
}

function TeamColumn({
  team, side, possession,
}: {
  team: TeamState;
  side: "home" | "visitor";
  possession: Possession;
}) {
  const color = side === "home" ? "var(--home-color)" : "var(--visitor-color)";

  return (
    <div className="flex-1 flex flex-col">
      {/* Colour bar */}
      <div style={{ height: 6, background: color, boxShadow: `0 0 20px ${color}66` }} />

      <div className="flex flex-col items-center justify-center py-10 px-6 flex-1">
        <ScorePanel team={team} side={side} possession={possession} size="full" />

        {/* Timeout pips */}
        {team.timeouts > 0 && (
          <div className="flex gap-2 mt-4">
            {Array.from({ length: Math.max(team.timeouts, 3) }).map((_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background: i < team.timeouts ? color : "var(--text-dim)",
                  boxShadow: i < team.timeouts ? `0 0 6px ${color}` : "none",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerStrip({ homeTeam, visitorTeam }: { homeTeam: TeamState; visitorTeam: TeamState }) {
  const homePlayers  = homeTeam.players.filter(p => p.onCourt);
  const visPlayers   = visitorTeam.players.filter(p => p.onCourt);
  if (homePlayers.length === 0 && visPlayers.length === 0) return null;

  return (
    <div
      className="px-6 py-4 flex gap-8 overflow-x-auto"
      style={{ borderTop: "1px solid var(--border)", background: "var(--bg-elevated)" }}
    >
      <PlayerList players={homePlayers} color="var(--home-color)" label={homeTeam.name} />
      <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />
      <PlayerList players={visPlayers} color="var(--visitor-color)" label={visitorTeam.name} />
    </div>
  );
}

function PlayerList({ players, color, label }: { players: TeamState["players"]; color: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-dim)" }}>
        {label} — On Court
      </p>
      <div className="flex flex-wrap gap-2">
        {players.map(p => (
          <div
            key={p.number}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold"
            style={{ background: `${color}18`, border: `1px solid ${color}33`, color }}
          >
            <span>#{p.number}</span>
            {p.name && <span className="font-normal" style={{ color: "var(--text-secondary)" }}>{p.name}</span>}
            {p.faults > 0 && <span style={{ color: "var(--danger)" }}>F{p.faults}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

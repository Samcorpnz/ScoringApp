"use client";

import { useState } from "react";
import { useMatchState } from "../../hooks/useMatchState";
import { useDisplayTheme } from "../../hooks/useDisplayTheme";
import { ScorePanel } from "../../components/ScorePanel";
import { ClockPanel } from "../../components/ClockPanel";
import { ConnectionBadge } from "../../components/ConnectionBadge";
import { TeamState, Possession, NetballMatchStats, NetballPlayerStats, NetballTeamStats } from "../../types";
import { getTemplate } from "../../sport-templates";

export default function AdvancedDisplay() {
  const { state, status, relayUnreachable } = useMatchState();
  const [showOnCourtOnly, setShowOnCourtOnly] = useState(true);
  const { textScale: _ts, competitionLogoUrl: _cl, ...themeStyle } = useDisplayTheme(state.displayTheme);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={themeStyle}
    >
      <div className="fixed top-4 right-4 z-10">
        <ConnectionBadge status={status} relayUnreachable={relayUnreachable} />
      </div>

      <div
        className="w-full max-w-6xl rounded-2xl overflow-hidden"
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
          <ConnectionBadge status={status} relayUnreachable={relayUnreachable} />
        </div>

        {/* Main scoreboard row */}
        <div className="flex items-stretch">
          <TeamColumn team={state.home} side="home" possession={state.possession} />
          <div
            className="flex flex-col items-center justify-center px-10 py-8 flex-shrink-0"
            style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}
          >
            <ClockPanel
              clockSeconds={state.clockSeconds}
              countDown={state.countDown}
              period={state.period}
              periodBreak={state.periodBreak}
              periodLabel={getTemplate(state.sport).periodLabel}
              isRunning={state.isRunning}
              hornActive={state.hornActive}
            />
          </div>
          <TeamColumn team={state.visitor} side="visitor" possession={state.possession} />
        </div>

        {/* Netball stats section */}
        {state.netballStats && (
          <NetballStatsSection
            stats={state.netballStats}
            homeColor="var(--home-color)"
            visitorColor="var(--visitor-color)"
            showOnCourtOnly={showOnCourtOnly}
            onToggle={() => setShowOnCourtOnly(v => !v)}
          />
        )}

        {/* Fallback player strip when no netball stats */}
        {!state.netballStats && (
          <PlayerStrip homeTeam={state.home} visitorTeam={state.visitor} />
        )}
      </div>
    </div>
  );
}

// ─── Score column ─────────────────────────────────────────────────────────────

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
      <div style={{ height: 6, background: color, boxShadow: `0 0 20px ${color}66` }} />
      <div className="flex flex-col items-center justify-center py-10 px-6 flex-1">
        <ScorePanel team={team} side={side} possession={possession} size="full" />
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

// ─── Netball stats section ────────────────────────────────────────────────────

function NetballStatsSection({
  stats,
  homeColor,
  visitorColor,
  showOnCourtOnly,
  onToggle,
}: {
  stats: NetballMatchStats;
  homeColor: string;
  visitorColor: string;
  showOnCourtOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {/* Section header + toggle */}
      <div
        className="px-6 py-3 flex items-center justify-between"
        style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>
          Player Stats
        </span>
        <button
          onClick={onToggle}
          className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
          style={{
            background: showOnCourtOnly ? "var(--accent)" : "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: showOnCourtOnly ? "#000" : "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          {showOnCourtOnly ? "On Court (7)" : "All Players"}
        </button>
      </div>

      {/* Team summary bars */}
      <div
        className="grid grid-cols-2 gap-px"
        style={{ background: "var(--border)" }}
      >
        <TeamSummaryBar team={stats.home} color={homeColor} align="left" />
        <TeamSummaryBar team={stats.visitor} color={visitorColor} align="right" />
      </div>

      {/* Player tables side by side */}
      <div
        className="grid grid-cols-2 gap-px"
        style={{ background: "var(--border)" }}
      >
        <PlayerStatsTable
          team={stats.home}
          color={homeColor}
          showOnCourtOnly={showOnCourtOnly}
          side="home"
        />
        <PlayerStatsTable
          team={stats.visitor}
          color={visitorColor}
          showOnCourtOnly={showOnCourtOnly}
          side="visitor"
        />
      </div>
    </div>
  );
}

// ─── Team summary bar ─────────────────────────────────────────────────────────

function TeamSummaryBar({
  team,
  color,
  align,
}: {
  team: NetballTeamStats;
  color: string;
  align: "left" | "right";
}) {
  const pct = team.goalAttempts > 0
    ? `${team.shootingPercentage.toFixed(1)}%`
    : "–";
  const cpEff = team.centrePassReceives > 0
    ? `${team.goalsFromCentrePass}/${team.centrePassReceives}`
    : "–";

  const stats = [
    { label: "Shooting", value: pct },
    { label: "CP Eff", value: cpEff },
    { label: "Gains", value: team.gain },
    { label: "Turnovers", value: team.turnovers },
    { label: "Penalties", value: team.penalties },
    { label: "Rebounds", value: team.rebounds },
    { label: "Intercepts", value: team.intercepts },
    { label: "Feeds", value: team.feeds },
  ];

  return (
    <div
      className="px-5 py-3 flex flex-wrap gap-x-5 gap-y-1"
      style={{ background: "var(--bg-elevated)" }}
    >
      {stats.map(s => (
        <div key={s.label} className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>{s.label}</span>
          <span className="text-sm font-bold" style={{ color }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Player stats table ───────────────────────────────────────────────────────

const ON_COURT_POSITIONS = new Set(["GS", "GA", "WA", "C", "WD", "GD", "GK"]);

function isOnCourt(p: NetballPlayerStats): boolean {
  return ON_COURT_POSITIONS.has(p.currentPosition);
}

function positionOrder(pos: string): number {
  const order: Record<string, number> = { GS: 0, GA: 1, WA: 2, C: 3, WD: 4, GD: 5, GK: 6, I: 7 };
  return order[pos] ?? 8;
}

function PlayerStatsTable({
  team,
  color,
  showOnCourtOnly,
  side,
}: {
  team: NetballTeamStats;
  color: string;
  showOnCourtOnly: boolean;
  side: "home" | "visitor";
}) {
  const filtered = team.players
    .filter(p => !showOnCourtOnly || isOnCourt(p))
    .sort((a, b) => positionOrder(a.currentPosition) - positionOrder(b.currentPosition));

  const cols = [
    { key: "pos", label: "Pos", align: "left" as const },
    { key: "name", label: "Player", align: "left" as const },
    { key: "goals", label: "G", align: "right" as const },
    { key: "goalAttempts", label: "GA", align: "right" as const },
    { key: "pct", label: "%", align: "right" as const },
    { key: "feeds", label: "Fd", align: "right" as const },
    { key: "goalAssists", label: "As", align: "right" as const },
    { key: "intercepts", label: "Int", align: "right" as const },
    { key: "penalties", label: "Pen", align: "right" as const },
  ];

  return (
    <div style={{ background: "var(--bg-surface)" }}>
      {/* Column headers */}
      <div
        className="grid text-xs font-bold tracking-wider uppercase px-4 py-2"
        style={{
          gridTemplateColumns: "48px 1fr 32px 32px 44px 32px 32px 36px 36px",
          color: "var(--text-dim)",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        {cols.map(c => (
          <span key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</span>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 && (
        <div className="px-4 py-6 text-xs text-center" style={{ color: "var(--text-dim)" }}>
          No players
        </div>
      )}
      {filtered.map(p => (
        <PlayerRow key={p.playerId} player={p} color={color} onCourt={isOnCourt(p)} />
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  color,
  onCourt,
}: {
  player: NetballPlayerStats;
  color: string;
  onCourt: boolean;
}) {
  const pct = player.goalAttempts > 0
    ? `${player.shootingPercentage.toFixed(0)}%`
    : "–";

  return (
    <div
      className="grid text-xs px-4 py-1.5 items-center"
      style={{
        gridTemplateColumns: "48px 1fr 32px 32px 44px 32px 32px 36px 36px",
        borderBottom: "1px solid var(--border)",
        opacity: onCourt ? 1 : 0.5,
      }}
    >
      {/* Position badge */}
      <span
        className="font-bold text-center rounded px-1"
        style={{
          background: onCourt ? `${color}22` : "transparent",
          color: onCourt ? color : "var(--text-dim)",
          fontSize: 10,
        }}
      >
        {player.currentPosition || "–"}
      </span>

      {/* Name */}
      <span className="truncate pr-2" style={{ color: "var(--text-primary)" }}>
        {player.playerSurname}
        {player.playerFirstname ? `, ${player.playerFirstname.charAt(0)}.` : ""}
      </span>

      {/* Stats */}
      <StatCell value={player.goals > 0 ? player.goals : "–"} highlight={player.goals > 0} color={color} />
      <StatCell value={player.goalAttempts > 0 ? player.goalAttempts : "–"} />
      <StatCell value={player.goalAttempts > 0 ? pct : "–"} highlight={player.goalAttempts > 0} color={color} />
      <StatCell value={player.feeds > 0 ? player.feeds : "–"} />
      <StatCell value={player.goalAssists > 0 ? player.goalAssists : "–"} />
      <StatCell value={player.intercepts > 0 ? player.intercepts : "–"} />
      <StatCell value={player.penalties > 0 ? player.penalties : "–"} />
    </div>
  );
}

function StatCell({
  value,
  highlight = false,
  color,
}: {
  value: string | number;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <span
      className="text-right font-mono"
      style={{ color: highlight && color ? color : "var(--text-secondary)" }}
    >
      {value}
    </span>
  );
}

// ─── Fallback player strip (no netball stats) ─────────────────────────────────

function PlayerStrip({ homeTeam, visitorTeam }: { homeTeam: TeamState; visitorTeam: TeamState }) {
  const homePlayers = homeTeam.players.filter(p => p.onCourt);
  const visPlayers  = visitorTeam.players.filter(p => p.onCourt);
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

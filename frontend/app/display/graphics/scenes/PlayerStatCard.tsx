"use client";

import type { SceneProps } from "./LowerThird";
import { formatStatLabel, orderStats } from "../../../sport-graphics-templates";

// Generic player stat card: resolves payload.playerId against the live
// graphicsFeed's flattened player stats (bridge/src/graphics/feedTransform.ts),
// ordered/labeled per sport-graphics-templates.ts where one exists.
// No Player/roster lookup yet (Phase C) — no photo, just name + stats.
export function PlayerStatCard({ payload, state }: SceneProps) {
  const playerId = typeof payload?.playerId === "string" || typeof payload?.playerId === "number"
    ? String(payload.playerId)
    : undefined;
  const player = state.graphicsFeed?.stats.players.find(p => p.id === playerId);

  if (!player) {
    return (
      <Card>
        <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>No live data for selected player</span>
      </Card>
    );
  }

  const teamColor = player.team === "home" ? "var(--home-color)" : "var(--visitor-color)";
  const statEntries = orderStats(state.sport, player.stats, "playerCardStats", ["firstName", "lastName"]);

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ width: 4, height: 20, background: teamColor, borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>{player.name}</span>
          <span style={{ fontSize: "0.6rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {player.team}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "4px 16px" }}>
          {statEntries.map(([key, value]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.5rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {formatStatLabel(state.sport, key)}
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(7,9,15,0.92)",
        borderRadius: 10,
        padding: "14px 20px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        minWidth: 280,
      }}
    >
      {children}
    </div>
  );
}

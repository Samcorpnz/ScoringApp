"use client";

import type { SceneProps } from "./LowerThird";

// Headshot+bio scene. No Player/roster model wired yet (that's Phase C:
// packages/db's Player model + roster admin UI) so this renders an initials
// avatar in place of a photo — swapping in a real photoUrl later is a
// one-line change here, not a new scene type.
export function PlayerHeadshotBio({ payload, state }: SceneProps) {
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
  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  const position = typeof player.stats.position === "string" ? player.stats.position : undefined;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--bg-elevated)",
            border: `2px solid ${teamColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            fontWeight: 800,
            color: teamColor,
            flexShrink: 0,
          }}
        >
          {initials || "?"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>{player.name}</span>
          <span style={{ fontSize: "0.6rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {[player.team, position].filter(Boolean).join(" · ")}
          </span>
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

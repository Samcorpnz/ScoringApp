"use client";

import { MatchState, formatScore } from "../../../types";

export interface SceneProps {
  payload?: Record<string, unknown>;
  state: MatchState;
}

// Phase A generic lower-third: team names/scores plus whatever team-level
// stats the current provider mapping produced (bridge/src/graphics/feedMappings).
// Deliberately renders raw statKey/value pairs rather than sport-specific
// labels — per-sport label/formatting is a Phase B concern
// (sport-graphics-templates.ts), not something this scene should hardcode.
export function LowerThird({ state }: SceneProps) {
  const feed = state.graphicsFeed;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 4px 32px rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(7,9,15,0.92)",
      }}
    >
      <TeamBlock name={state.home.name || "HOME"} score={formatScore(state, "home")} color="var(--home-color)" stats={feed?.stats.team.home} align="right" />
      <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.08)" }} />
      <TeamBlock name={state.visitor.name || "VISITOR"} score={formatScore(state, "visitor")} color="var(--visitor-color)" stats={feed?.stats.team.visitor} align="left" />
    </div>
  );
}

function TeamBlock({
  name, score, color, stats, align,
}: {
  name: string;
  score: string;
  color: string;
  stats?: Record<string, number | string>;
  align: "left" | "right";
}) {
  const statEntries = Object.entries(stats ?? {}).filter(([key]) => key !== "squadName").slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-start" : "flex-end", padding: "10px 20px", minWidth: 200 }}>
      <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
        {name}
      </span>
      <span className="score-digit" style={{ fontSize: "2rem", color, textShadow: `0 0 20px ${color}44` }}>
        {score}
      </span>
      {statEntries.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          {statEntries.map(([key, value]) => (
            <span key={key} style={{ fontSize: "0.55rem", color: "var(--text-dim)" }}>
              {formatStatLabel(key)}: <strong style={{ color: "var(--text-secondary)" }}>{value}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatStatLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
}

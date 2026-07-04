"use client";

import { useSession } from "next-auth/react";
import { useMatchState } from "../../hooks/useMatchState";
import { useGraphicsToken } from "../../hooks/useGraphicsToken";
import { useGraphicsScene } from "../../hooks/useGraphicsScene";

// Graphics Operator add-on control UI — a standalone route (like
// control/mobile), not a tab bolted onto the scoring control panel, since
// this is meant to be run by a separate person/device from the scoring
// operator (though per product decision a scoring operator may also use
// this to drive scenes solo on smaller productions).
export default function GraphicsControl() {
  useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/control/graphics";
    },
  });

  const graphicsToken = useGraphicsToken();
  const { state } = useMatchState();
  const { scene, status, setScene } = useGraphicsScene({ secret: graphicsToken, role: "graphics" });

  const players = state.graphicsFeed?.stats.players ?? [];
  const isLive = (sceneType: string, playerId?: string) =>
    scene?.sceneType === sceneType && (!playerId || scene.payload?.playerId === playerId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Graphics Control</h1>
        <span className={`status-dot ${status === "connected" ? "connected" : status === "connecting" ? "connecting" : "disconnected"}`} />
        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{state.matchName || "No match name set"}</span>
      </div>

      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Scenes</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <SceneButton label="Lower Third" active={isLive("lowerThird")} onClick={() => setScene("lowerThird")} />
          <SceneButton label="Clear" active={!scene} onClick={() => setScene("")} />
        </div>
      </section>

      <section>
        <SectionLabel>Player Stat Cards</SectionLabel>
        {players.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 8 }}>
            No live player feed yet — connect a data provider (e.g. Champion Data) to populate this list.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
            {players.map(p => (
              <SceneButton
                key={p.id}
                label={p.name}
                sub={p.team}
                active={isLive("playerStatCard", p.id)}
                onClick={() => setScene("playerStatCard", { playerId: p.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
    </span>
  );
}

function SceneButton({ label, sub, active, onClick }: { label: string; sub?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 10,
        padding: "10px 14px",
        textAlign: "left",
        background: active ? "var(--accent-dim)" : "var(--bg-surface)",
        border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--text-primary)",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: "0.6rem", color: "var(--text-dim)", textTransform: "uppercase" }}>{sub}</div>}
    </button>
  );
}

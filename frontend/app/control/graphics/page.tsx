"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useMatchState } from "../../hooks/useMatchState";
import { useGraphicsToken } from "../../hooks/useGraphicsToken";
import { useGraphicsScene } from "../../hooks/useGraphicsScene";

// Graphics Operator add-on control UI — a standalone route (like
// control/mobile), not a tab bolted onto the scoring control panel, since
// this is meant to be run by a separate person/device from the scoring
// operator (though per product decision a scoring operator may also use
// this to drive scenes solo on smaller productions).
export default function GraphicsControlPage() {
  return (
    <Suspense>
      <GraphicsControl />
    </Suspense>
  );
}

function connectionStatusClass(status: string): string {
  if (status === "connected") return "connected";
  if (status === "connecting") return "connecting";
  return "disconnected";
}

function GraphicsControl() {
  const { data: session } = useSession({
    required: true,
    onUnauthenticated() {
      globalThis.location.href = "/login?callbackUrl=/control/graphics";
    },
  });
  // Without ?matchId=, both the graphics token and the state socket below
  // scope to the org's singleton "default" room — wrong (or empty) once an
  // org has more than one match going, same reasoning as OutputsTab's
  // withOrg() for display links. OutputsTab's "Graphics Control" link
  // passes it; this only stays unscoped if the route is opened directly.
  const matchId = useSearchParams().get("matchId") ?? undefined;

  const { token: graphicsToken, status: entitlementStatus } = useGraphicsToken(matchId);
  // Authenticated with the graphics token (role: "graphics"), not a control
  // token — this page only reads state and switches scenes, and a "control"
  // role would enter the scoring controller mutex (relay/src/server.ts's
  // isControl block) and contend with whoever's actually scoring the match
  // on a separate device, which is the exact scenario this page is meant to
  // run alongside.
  const { state } = useMatchState({ secret: graphicsToken, role: "graphics" });
  const { scene, status, setScene } = useGraphicsScene({ secret: graphicsToken, role: "graphics" });

  const players = state.graphicsFeed?.stats.players ?? [];
  const isLive = (sceneType: string, playerId?: string) =>
    scene?.sceneType === sceneType && (!playerId || scene.payload?.playerId === playerId);

  if (entitlementStatus === "forbidden") {
    return <GraphicsUpsell isAdmin={session?.user?.activeRole === "ADMIN"} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Graphics Control</h1>
        <span className={`status-dot ${connectionStatusClass(status)}`} />
        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{state.matchName || "No match name set"}</span>
      </div>

      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Scenes</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <SceneButton testId="scene-btn-lowerThird" label="Lower Third" preview={<LowerThirdThumb />} active={isLive("lowerThird")} onClick={() => setScene("lowerThird")} />
          <SceneButton testId="scene-btn-clear" label="Clear" preview={<ClearThumb />} active={!scene} onClick={() => setScene("")} />
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
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
                testId={`scene-btn-statCard-${p.id}`}
                label={p.name}
                sub={p.team}
                preview={<StatCardThumb />}
                active={isLive("playerStatCard", p.id)}
                onClick={() => setScene("playerStatCard", { playerId: p.id })}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>Player Headshot + Bio</SectionLabel>
        {players.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 8 }}>
            No live player feed yet — connect a data provider (e.g. Champion Data) to populate this list.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
            {players.map(p => (
              <SceneButton
                key={p.id}
                testId={`scene-btn-headshotBio-${p.id}`}
                label={p.name}
                sub={p.team}
                preview={<HeadshotThumb />}
                active={isLive("playerHeadshotBio", p.id)}
                onClick={() => setScene("playerHeadshotBio", { playerId: p.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GraphicsUpsell({ isAdmin }: { readonly isAdmin: boolean }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", padding: 24, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, marginTop: "10vh", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 8 }}>Unlock Graphics Control</h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 20 }}>
          Broadcast-style lower thirds, player stat cards, and headshot bios — pushed live to your display outputs
          in real time, driven straight from your existing scoring feed.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", textAlign: "left", fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 8 }}>
          <li>✓ Live-feed-driven scenes — no manual data entry</li>
          <li>✓ Per-match theming to match your competition branding</li>
          <li>✓ One-click scene switching from a second device</li>
        </ul>
        {isAdmin ? (
          <a
            href="/account"
            style={{ display: "inline-block", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", borderRadius: 8, padding: "10px 20px", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}
          >
            Add Graphics — $29/mo
          </a>
        ) : (
          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Ask your account admin to add Graphics Operator ($29/mo) from Account settings.
          </p>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
    </span>
  );
}

function SceneButton({ testId, label, sub, preview, active, onClick }: {
  readonly testId?: string; readonly label: string; readonly sub?: string; readonly preview?: React.ReactNode; readonly active: boolean; readonly onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRadius: 10,
        padding: "10px 14px",
        textAlign: "left",
        background: active ? "var(--accent-dim)" : "var(--bg-surface)",
        border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--text-primary)",
        cursor: "pointer",
      }}
    >
      {preview && <div style={{ pointerEvents: "none" }}>{preview}</div>}
      <div>
        <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: "0.6rem", color: "var(--text-dim)", textTransform: "uppercase" }}>{sub}</div>}
      </div>
    </button>
  );
}

// Small non-interactive glyphs, not live-rendered scene components — a real
// preview would need a live graphicsFeed sample per thumbnail, which is more
// than this control UI needs; these just give the operator a visual shape
// to distinguish scene types at a glance.
function ThumbShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div style={{
      width: "100%", height: 44, borderRadius: 6, background: "rgba(255,255,255,0.04)",
      border: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 8px", gap: 6,
    }}>
      {children}
    </div>
  );
}

function LowerThirdThumb() {
  return (
    <ThumbShell>
      <div style={{ width: 3, height: 18, background: "var(--home-color)", borderRadius: 2 }} />
      <div style={{ width: 24, height: 6, background: "var(--text-dim)", borderRadius: 2 }} />
      <div style={{ flex: 1 }} />
      <div style={{ width: 24, height: 6, background: "var(--text-dim)", borderRadius: 2 }} />
      <div style={{ width: 3, height: 18, background: "var(--visitor-color)", borderRadius: 2 }} />
    </ThumbShell>
  );
}

function StatCardThumb() {
  return (
    <ThumbShell>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, width: "100%" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 16, background: "rgba(255,255,255,0.08)", borderRadius: 2 }} />
        ))}
      </div>
    </ThumbShell>
  );
}

function HeadshotThumb() {
  return (
    <ThumbShell>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent-dim)", flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        <div style={{ width: "70%", height: 5, background: "var(--text-dim)", borderRadius: 2 }} />
        <div style={{ width: "40%", height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }} />
      </div>
    </ThumbShell>
  );
}

function ClearThumb() {
  return <ThumbShell><span style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>Blank output</span></ThumbShell>;
}

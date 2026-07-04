"use client";

/**
 * Graphics Operator add-on — the single stable Browser Source URL. Drop this
 * into OBS/vMix/Wirecast once; an operator on /control/graphics switches
 * what renders here without ever touching the source/URL again.
 */

import { useEffect, useState } from "react";
import { useMatchState } from "../../hooks/useMatchState";
import { useGraphicsScene } from "../../hooks/useGraphicsScene";
import { SCENE_REGISTRY } from "./scenes/sceneRegistry";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

export default function GraphicsDisplay() {
  const { state } = useMatchState();
  const { scene } = useGraphicsScene();
  const [entitled, setEntitled] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const org = params.get("org");
    const url = org ? `${RELAY_URL}/api/graphics/entitlement?org=${encodeURIComponent(org)}` : `${RELAY_URL}/api/graphics/entitlement`;
    fetch(url)
      .then(res => res.json())
      .then(data => setEntitled(Boolean(data.entitled)))
      .catch(() => setEntitled(null));
  }, []);

  const SceneComponent = scene ? SCENE_REGISTRY[scene.sceneType] : undefined;

  return (
    <div
      style={{
        background: "transparent",
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {entitled === false ? (
        <UpgradePrompt />
      ) : SceneComponent ? (
        <SceneComponent payload={scene?.payload} state={state} />
      ) : null}
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "20px 32px",
        borderRadius: 12,
        background: "rgba(7,9,15,0.85)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
      }}
    >
      <span style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.02em", color: "var(--accent)" }}>
        ScoreHub
      </span>
      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
        Upgrade your plan to unlock the Graphics Operator add-on
      </span>
    </div>
  );
}

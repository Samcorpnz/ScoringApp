"use client";

/**
 * Streaming overlay — transparent background, designed to sit in OBS/vMix.
 * Drop it as a Browser Source, set width=1920 height=120 (or similar).
 */

import { useMatchState } from "../../hooks/useMatchState";
import { useDisplayTheme } from "../../hooks/useDisplayTheme";
import { useInterpolatedClock } from "../../hooks/useInterpolatedClock";
import { ScorePanel } from "../../components/ScorePanel";
import { ClockPanel } from "../../components/ClockPanel";
import { formatClockDisplay } from "../../types";
import { getTemplate } from "../../sport-templates";

export default function OverlayDisplay() {
  const { state } = useMatchState();
  const { home, visitor, clockSeconds, countDown, period, isRunning, hornActive, possession } = state;
  const { periodLabel } = getTemplate(state.sport);
  const displayClock = useInterpolatedClock({ clockSeconds, isRunning, countDown });
  const { backgroundColor: _bg, textScale: _ts, competitionLogoUrl: _cl, ...themeVars } = useDisplayTheme(state.displayTheme);

  return (
    <div
      style={{
        background: "transparent",
        ...themeVars,
        width: "100vw",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "0 0 24px 0",
        pointerEvents: "none",
      }}
    >
      {/* Lower-third bar */}
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
        }}
      >
        {/* Home team block */}
        <TeamBlock
          name={home.name || "HOME"}
          score={home.score}
          color="var(--home-color)"
          hasPossession={possession === "home" || possession === "both"}
          align="right"
        />

        {/* Center clock/period */}
        <div
          style={{
            background: "rgba(7,9,15,0.92)",
            padding: "10px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            minWidth: 110,
          }}
        >
          <span
            className="clock-digit"
            style={{
              fontSize: "1.6rem",
              color: hornActive ? "var(--danger)" : isRunning ? "#fff" : "var(--text-secondary)",
              lineHeight: 1,
            }}
          >
            {formatClockDisplay(displayClock)}
          </span>
          <span
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: state.periodBreak ? "rgb(251,146,60)" : "var(--accent)",
              textTransform: "uppercase",
            }}
          >
            {state.periodBreak
              ? (periodLabel === "HALF" ? "HALF TIME" : `${periodLabel} BREAK`)
              : (period === "E" ? "EXTRA" : `${periodLabel} ${period}`)}
          </span>
          {!isRunning && !state.periodBreak && (
            <span style={{ fontSize: "0.5rem", color: "var(--stopped)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              PAUSED
            </span>
          )}
        </div>

        {/* Visitor team block */}
        <TeamBlock
          name={visitor.name || "VISITOR"}
          score={visitor.score}
          color="var(--visitor-color)"
          hasPossession={possession === "visitor" || possession === "both"}
          align="left"
        />
      </div>
    </div>
  );
}

function TeamBlock({
  name, score, color, hasPossession, align,
}: {
  name: string;
  score: number;
  color: string;
  hasPossession: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      style={{
        background: "rgba(7,9,15,0.92)",
        display: "flex",
        flexDirection: align === "right" ? "row" : "row-reverse",
        alignItems: "center",
        gap: 12,
        padding: "8px 20px",
        minWidth: 180,
      }}
    >
      {/* Colour strip */}
      <div
        style={{
          width: 4,
          alignSelf: "stretch",
          borderRadius: 2,
          background: color,
          boxShadow: `0 0 8px ${color}88`,
          flexShrink: 0,
          order: align === "right" ? -1 : 1,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: align === "right" ? "flex-start" : "flex-end",
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {name}
          {hasPossession && (
            <span style={{ color, marginLeft: 6 }}>●</span>
          )}
        </span>
        <span
          className="score-digit"
          style={{ fontSize: "2.2rem", color, textShadow: `0 0 20px ${color}44` }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

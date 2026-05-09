"use client";

import { formatClockDisplay } from "../types";
import { useInterpolatedClock } from "../hooks/useInterpolatedClock";

interface Props {
  clockSeconds: number;
  countDown: boolean;
  period: string;
  isRunning: boolean;
  hornActive: boolean;
  matchName?: string;
  size?: "full" | "compact";
}

export function ClockPanel({ clockSeconds, countDown, period, isRunning, hornActive, matchName, size = "full" }: Props) {
  const isCompact = size === "compact";
  const display = useInterpolatedClock({ clockSeconds, isRunning, countDown });

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      {/* Match name */}
      {!isCompact && matchName && (
        <p
          className="uppercase tracking-widest font-semibold text-center"
          style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}
        >
          {matchName}
        </p>
      )}

      {/* Clock */}
      <div
        className={`clock-digit ${hornActive ? "horn-active" : ""}`}
        style={{
          fontSize: isCompact ? "2rem" : "4.5rem",
          color: hornActive ? "var(--danger)" : isRunning ? "var(--text-primary)" : "var(--text-secondary)",
          textShadow: isRunning && !hornActive
            ? "0 0 30px rgba(255,255,255,0.15)"
            : hornActive
              ? "0 0 30px rgba(239,68,68,0.5)"
              : "none",
        }}
      >
        {formatClockDisplay(display)}
      </div>

      {/* Period */}
      <div className="flex flex-col items-center gap-1">
        <p
          className="uppercase font-black tracking-widest"
          style={{ fontSize: isCompact ? "1.2rem" : "2rem", color: "var(--accent)" }}
        >
          {period}
        </p>
        <p
          className="uppercase tracking-widest font-semibold"
          style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}
        >
          {period === "E" ? "EXTRA TIME" : "QTR"}
        </p>
      </div>

      {/* Running indicator */}
      {!isCompact && (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: isRunning ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.08)",
            border: `1px solid ${isRunning ? "rgba(34,197,94,0.25)" : "rgba(148,163,184,0.15)"}`,
          }}
        >
          <span
            className="status-dot"
            style={{ background: isRunning ? "var(--running)" : "var(--stopped)",
              boxShadow: isRunning ? "0 0 6px var(--running)" : "none" }}
          />
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: isRunning ? "var(--running)" : "var(--stopped)" }}
          >
            {isRunning ? "LIVE" : "PAUSED"}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";

export function useInterpolatedClock({
  clockSeconds,
  isRunning,
  countDown,
  clockAnchorMs,
  clockCarryMs,
}: {
  clockSeconds: number;
  isRunning: boolean;
  countDown: boolean;
  clockAnchorMs?: number;
  clockCarryMs?: number;
}): number {
  // When the relay supplies a precise anchor/carry (relay-tick-loop-driven
  // matches), preciseSeconds is the exact value at clockAnchorMs — no more
  // guessing at a fractional remainder. When absent (bridge-driven matches,
  // or an un-updated caller), carry is 0 and this collapses to clockSeconds,
  // matching the previous ad-hoc-local-anchor behavior exactly.
  const direction = countDown ? -1 : 1;
  const preciseSeconds = clockSeconds + direction * ((clockCarryMs ?? 0) / 1000);

  const [display, setDisplay] = useState(preciseSeconds);
  const lastRef = useRef({ time: clockAnchorMs ?? Date.now(), seconds: preciseSeconds });

  // Sync baseline whenever the server sends a new value
  useEffect(() => {
    lastRef.current = { time: clockAnchorMs ?? Date.now(), seconds: preciseSeconds };
    // Snap to the precise (anchor+carry) value, not the bare integer — this
    // is exactly what interpolation was already converging toward, so
    // stopping never produces a visible backward jump.
    if (!isRunning) setDisplay(preciseSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockSeconds, isRunning, countDown, clockAnchorMs, clockCarryMs]);

  // Interpolation — 50ms interval fills in the tenths between relay ticks
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const elapsed = Math.min((Date.now() - lastRef.current.time) / 1000, 1.1);
      const val = countDown
        ? lastRef.current.seconds - elapsed
        : lastRef.current.seconds + elapsed;
      setDisplay(Math.max(0, val));
    }, 50);
    return () => clearInterval(id);
  }, [isRunning, countDown]);

  return display;
}

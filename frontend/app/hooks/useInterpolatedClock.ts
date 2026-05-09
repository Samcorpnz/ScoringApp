"use client";

import { useState, useEffect, useRef } from "react";

export function useInterpolatedClock({
  clockSeconds,
  isRunning,
  countDown,
}: {
  clockSeconds: number;
  isRunning: boolean;
  countDown: boolean;
}): number {
  const [display, setDisplay] = useState(clockSeconds);
  const lastRef = useRef({ time: Date.now(), seconds: clockSeconds });

  // Sync baseline whenever the server sends a new value
  useEffect(() => {
    lastRef.current = { time: Date.now(), seconds: clockSeconds };
    if (!isRunning) setDisplay(clockSeconds);
  }, [clockSeconds, isRunning]);

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

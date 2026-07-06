export interface ClockAnchorState {
  clockSeconds: number;
  clockAnchorMs?: number;
  clockCarryMs?: number;
  countDown: boolean;
}

export interface ResyncedClock {
  clockSeconds: number;
  clockAnchorMs: number;
  clockCarryMs: number;
}

// Folds all real elapsed wall-clock time since the last anchor into
// clockSeconds (whole seconds) + clockCarryMs (signed sub-second remainder),
// then re-anchors to `nowMs`. clockCarryMs is preserved indefinitely across
// stop/start cycles instead of being discarded, so no millisecond of real
// elapsed time is ever lost — each call is a checkpoint, not a truncation.
export function resyncClock(state: ClockAnchorState, nowMs: number = Date.now()): ResyncedClock {
  const anchorMs = state.clockAnchorMs ?? nowMs;
  const carryMs = state.clockCarryMs ?? 0;
  const elapsedMs = Math.max(0, nowMs - anchorMs);
  const totalMs = carryMs + elapsedMs;
  const wholeSeconds = Math.trunc(totalMs / 1000);
  const remainderMs = totalMs - wholeSeconds * 1000;
  const delta = state.countDown ? -wholeSeconds : wholeSeconds;
  return {
    clockSeconds: state.clockSeconds + delta,
    clockAnchorMs: nowMs,
    clockCarryMs: remainderMs,
  };
}

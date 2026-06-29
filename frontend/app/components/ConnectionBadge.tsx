"use client";
import { ConnectionStatus } from "../hooks/useMatchState";

const labels: Record<ConnectionStatus, string> = {
  connected: "LIVE",
  connecting: "CONNECTING",
  disconnected: "OFFLINE",
};

export function ConnectionBadge({
  status,
  feedStale,
  relayUnreachable,
}: {
  status: ConnectionStatus;
  feedStale?: boolean;
  relayUnreachable?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
      <span className={`status-dot ${status}`} />
      <span style={{ color: status === "connected" ? "var(--running)" : status === "connecting" ? "var(--accent)" : "var(--stopped)" }}>
        {labels[status]}
      </span>
      {feedStale && (
        <>
          <span className="status-dot stale" />
          <span style={{ color: "var(--warning)" }}>FEED STALE</span>
        </>
      )}
      {relayUnreachable && (
        <>
          <span className="status-dot disconnected" />
          <span style={{ color: "var(--danger, #e5484d)" }}>RELAY UNREACHABLE</span>
        </>
      )}
    </div>
  );
}

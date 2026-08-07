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
  readonly status: ConnectionStatus;
  readonly feedStale?: boolean;
  readonly relayUnreachable?: boolean;
}) {
  let statusColor: string;
  if (status === "connected") {
    statusColor = "var(--running)";
  } else if (status === "connecting") {
    statusColor = "var(--accent)";
  } else {
    statusColor = "var(--stopped)";
  }
  return (
    <div data-testid="connection-badge" className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
      <span className={`status-dot ${status}`} />
      <span data-testid="connection-status" style={{ color: statusColor }}>
        {labels[status]}
      </span>
      {feedStale && (
        <>
          <span className="status-dot stale" />
          <span data-testid="connection-feed-stale" style={{ color: "var(--warning)" }}>FEED STALE</span>
        </>
      )}
      {relayUnreachable && (
        <>
          <span className="status-dot disconnected" />
          <span data-testid="connection-relay-unreachable" style={{ color: "var(--danger, #e5484d)" }}>RELAY UNREACHABLE</span>
        </>
      )}
    </div>
  );
}

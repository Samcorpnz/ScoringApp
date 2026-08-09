import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConnectionBadge } from "../ConnectionBadge";

afterEach(cleanup);

describe("ConnectionBadge", () => {
  it("renders LIVE for connected status without extra warnings", () => {
    render(<ConnectionBadge status="connected" />);
    expect(screen.getByTestId("connection-status")).toHaveTextContent("LIVE");
    expect(screen.queryByTestId("connection-feed-stale")).not.toBeInTheDocument();
    expect(screen.queryByTestId("connection-relay-unreachable")).not.toBeInTheDocument();
  });

  it("renders CONNECTING for connecting status", () => {
    render(<ConnectionBadge status="connecting" />);
    expect(screen.getByTestId("connection-status")).toHaveTextContent("CONNECTING");
  });

  it("renders OFFLINE for disconnected status", () => {
    render(<ConnectionBadge status="disconnected" />);
    expect(screen.getByTestId("connection-status")).toHaveTextContent("OFFLINE");
  });

  it("shows the FEED STALE warning when feedStale is true", () => {
    render(<ConnectionBadge status="connected" feedStale={true} />);
    expect(screen.getByTestId("connection-feed-stale")).toHaveTextContent("FEED STALE");
  });

  it("shows the RELAY UNREACHABLE warning when relayUnreachable is true", () => {
    render(<ConnectionBadge status="disconnected" relayUnreachable={true} />);
    expect(screen.getByTestId("connection-relay-unreachable")).toHaveTextContent("RELAY UNREACHABLE");
  });

  it("can show both warnings simultaneously", () => {
    render(<ConnectionBadge status="connecting" feedStale={true} relayUnreachable={true} />);
    expect(screen.getByTestId("connection-feed-stale")).toBeInTheDocument();
    expect(screen.getByTestId("connection-relay-unreachable")).toBeInTheDocument();
  });
});

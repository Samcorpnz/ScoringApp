import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { PlanBadge } from "../PlanBadge";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlanBadge", () => {
  it("renders nothing before the fetch resolves and nothing if plan is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
    const { container } = render(<PlanBadge />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/billing/status"));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the plan name as a link to /account/billing once loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ plan: "PRO" }) }));
    render(<PlanBadge />);
    const link = await screen.findByText("PRO");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/account/billing");
  });

  it("renders nothing when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const { container } = render(<PlanBadge />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

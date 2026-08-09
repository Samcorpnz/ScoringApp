import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import BillingPage from "../page";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BillingPage", () => {
  it("redirects to /account and renders nothing", async () => {
    const { container } = render(<BillingPage />);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/account"));
  });

  it("only issues a single replace call", async () => {
    render(<BillingPage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
  });
});

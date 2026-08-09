import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Providers } from "../providers";

const { sessionProviderMock } = vi.hoisted(() => ({
  sessionProviderMock: vi.fn(({ children }: { readonly children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  )),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: sessionProviderMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Providers", () => {
  it("wraps children in next-auth's SessionProvider", () => {
    render(
      <Providers>
        <div data-testid="child">content</div>
      </Providers>
    );
    expect(sessionProviderMock).toHaveBeenCalled();
    expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

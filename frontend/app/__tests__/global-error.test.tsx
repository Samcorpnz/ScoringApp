import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import GlobalError from "../global-error";

const { captureExceptionMock } = vi.hoisted(() => ({ captureExceptionMock: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GlobalError", () => {
  it("reports the error to Sentry on mount", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<GlobalError error={error} />);
    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });

  it("renders a fallback message for the user", () => {
    render(<GlobalError error={new Error("boom")} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("re-reports when the error instance changes", () => {
    const first = new Error("first");
    const { rerender } = render(<GlobalError error={first} />);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);

    const second = new Error("second");
    rerender(<GlobalError error={second} />);
    expect(captureExceptionMock).toHaveBeenCalledTimes(2);
    expect(captureExceptionMock).toHaveBeenLastCalledWith(second);
  });
});

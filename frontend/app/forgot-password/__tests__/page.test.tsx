import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ForgotPasswordPage from "../page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ForgotPasswordPage", () => {
  it("disables submit for an invalid email", () => {
    render(<ForgotPasswordPage />);
    const button = screen.getByRole("button", { name: "Send reset link" });
    expect(button).toBeDisabled();

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-an-email" } });
    expect(button).toBeDisabled();
  });

  it("submits to /api/auth/forgot-password and shows the check-your-email state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    render(<ForgotPasswordPage />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/forgot-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "sam@example.com", turnstileToken: "" }),
        })
      )
    );
    await waitFor(() => expect(screen.getByText("Check your email")).toBeInTheDocument());
  });

  it("shows the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "too many requests" }) })
    );

    render(<ForgotPasswordPage />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByText("too many requests")).toBeInTheDocument());
  });
});

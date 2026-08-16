import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ResetPasswordPage from "../page";

const { pushMock, searchParamsMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

function paramsWithToken(token: string | null) {
  return { get: (key: string) => (key === "token" ? token : null) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("ResetPasswordPage", () => {
  it("shows an error when the URL is missing a token", () => {
    searchParamsMock.mockReturnValue(paramsWithToken(null));
    render(<ResetPasswordPage />);
    expect(screen.getByText("This reset link is missing a token.")).toBeInTheDocument();
  });

  it("shows the server's error when the token is invalid or expired", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("bad-token"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "reset link expired" }) })
    );
    render(<ResetPasswordPage />);
    await waitFor(() => expect(screen.getByText("reset link expired")).toBeInTheDocument());
  });

  it("submits the new password and shows a confirmation", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "valid" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ResetPasswordPage />);
    await screen.findByText("Save new password");
    expect(screen.getByText("Save new password")).toBeDisabled();

    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "longenough" } });
    fireEvent.click(screen.getByText("Save new password"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/reset-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "good-token", password: "longenough" }),
        })
      )
    );
    await waitFor(() => expect(screen.getByText("Password updated. Redirecting to sign in…")).toBeInTheDocument());
  });

  it("shows the server error when the reset fails", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "valid" }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "reset link expired" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ResetPasswordPage />);
    await screen.findByText("Save new password");

    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "longenough" } });
    fireEvent.click(screen.getByText("Save new password"));

    await waitFor(() => expect(screen.getByText("reset link expired")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });
});

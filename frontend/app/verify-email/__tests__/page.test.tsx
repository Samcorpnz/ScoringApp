import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import VerifyEmailPage from "../page";

const { searchParamsMock } = vi.hoisted(() => ({ searchParamsMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

function paramsWithToken(token: string | null) {
  return { get: (key: string) => (key === "token" ? token : null) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("VerifyEmailPage", () => {
  it("shows an error when no token is present in the URL", () => {
    searchParamsMock.mockReturnValue(paramsWithToken(null));
    render(<VerifyEmailPage />);
    expect(screen.getByText("Missing verification token.")).toBeInTheDocument();
  });

  it("shows 'Verifying…' then success once the confirm request resolves", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("abc123"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<VerifyEmailPage />);
    expect(screen.getByText("Verifying…")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("Your email address has been updated.")).toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/account/email/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "abc123" }),
      })
    );
    expect(screen.getByText("Sign in →").closest("a")).toHaveAttribute("href", "/login");
  });

  it("shows the server error message when the confirm request fails", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("bad-token"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "token expired" }) })
    );
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText("token expired")).toBeInTheDocument());
  });

  it("shows a generic error message when the failure response has no error field", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("bad-token"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText("verification failed")).toBeInTheDocument());
  });
});

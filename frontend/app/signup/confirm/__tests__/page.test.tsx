import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import SignupConfirmPage from "../page";

const { pushMock, searchParamsMock, signInMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: vi.fn(),
  signInMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

function paramsWithToken(token: string | null) {
  return { get: (key: string) => (key === "token" ? token : null) };
}

const signupInfo = { email: "new@example.com", name: "Ann Lee", orgName: "Wellington Netball" };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SignupConfirmPage", () => {
  it("shows an error when the URL is missing a token", () => {
    searchParamsMock.mockReturnValue(paramsWithToken(null));
    render(<SignupConfirmPage />);
    expect(screen.getByText("This signup link is missing a token.")).toBeInTheDocument();
  });

  it("shows the server's error when the lookup fails", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("bad-token"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "signup link expired" }) })
    );
    render(<SignupConfirmPage />);
    await waitFor(() => expect(screen.getByText("signup link expired")).toBeInTheDocument());
  });

  it("creates the account, signs in, and redirects to /setup", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => signupInfo })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    signInMock.mockResolvedValue({ error: undefined });

    const { container } = render(<SignupConfirmPage />);
    await screen.findByText("Create account");
    expect(screen.getByText("Create account")).toBeDisabled();

    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "longenough" } });
    fireEvent.click(screen.getByText("Create account"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/signup/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "good-token", password: "longenough" }),
        })
      )
    );
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        email: signupInfo.email,
        password: "longenough",
        redirect: false,
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/setup"));
  });

  it("shows the server error when account creation fails", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => signupInfo })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "signup link expired" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SignupConfirmPage />);
    await screen.findByText("Create account");

    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "longenough" } });
    fireEvent.click(screen.getByText("Create account"));

    await waitFor(() => expect(screen.getByText("signup link expired")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });
});

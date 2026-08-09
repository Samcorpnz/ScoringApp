import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import InviteAcceptPage from "../page";

const { pushMock, searchParamsMock, useSessionMock, signInMock, updateSessionMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: vi.fn(),
  useSessionMock: vi.fn(),
  signInMock: vi.fn(),
  updateSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
  signIn: signInMock,
}));

function paramsWithToken(token: string | null) {
  return { get: (key: string) => (key === "token" ? token : null) };
}

const invitationInfo = {
  email: "invitee@example.com",
  orgName: "Acme Netball",
  role: "OPERATOR",
  accountExists: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("InviteAcceptPage", () => {
  it("shows an error when the URL is missing a token", () => {
    searchParamsMock.mockReturnValue(paramsWithToken(null));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    render(<InviteAcceptPage />);
    expect(screen.getByText("This invitation link is missing a token.")).toBeInTheDocument();
  });

  it("shows the server's error when the invitation lookup fails", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("bad-token"));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "invitation expired" }) })
    );
    render(<InviteAcceptPage />);
    await waitFor(() => expect(screen.getByText("invitation expired")).toBeInTheDocument());
  });

  it("shows a 'Join' button when the logged-in user matches the invited email", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({
      data: { user: { email: "invitee@example.com" } },
      status: "authenticated",
      update: updateSessionMock,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => invitationInfo }));
    render(<InviteAcceptPage />);

    await waitFor(() => expect(screen.getByText(`Join ${invitationInfo.orgName}`)).toBeInTheDocument());
  });

  it("accepts the invitation as the logged-in user and redirects to /dashboard", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({
      data: { user: { email: "invitee@example.com" } },
      status: "authenticated",
      update: updateSessionMock,
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => invitationInfo })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<InviteAcceptPage />);

    const joinButton = await screen.findByText(`Join ${invitationInfo.orgName}`);
    fireEvent.click(joinButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/invitations/accept",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "good-token" }) })
      )
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("prompts for a password to log in when the invited email already has an account", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...invitationInfo, accountExists: true }) })
    );
    render(<InviteAcceptPage />);

    await waitFor(() => expect(screen.getByText("Log in and join")).toBeInTheDocument());
    expect(screen.getByText("Log in and join")).toBeDisabled();
  });

  it("logs in, then accepts the invitation, when an existing account enters a password", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...invitationInfo, accountExists: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    signInMock.mockResolvedValue({ error: undefined });
    updateSessionMock.mockResolvedValue(undefined);

    const { container } = render(<InviteAcceptPage />);
    await screen.findByText("Log in and join");

    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "secret123" } });
    fireEvent.click(screen.getByText("Log in and join"));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        email: invitationInfo.email,
        password: "secret123",
        redirect: false,
      })
    );
    await waitFor(() => expect(updateSessionMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows 'incorrect password' when login fails for an existing account", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...invitationInfo, accountExists: true }) })
    );
    signInMock.mockResolvedValue({ error: "CredentialsSignin" });

    const { container } = render(<InviteAcceptPage />);
    await screen.findByText("Log in and join");

    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("Log in and join"));

    await waitFor(() => expect(screen.getByText("incorrect password")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("creates an account and joins for a brand new invitee", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => invitationInfo })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    signInMock.mockResolvedValue({ error: undefined });

    const { container } = render(<InviteAcceptPage />);
    await screen.findByText("Create account and join");
    expect(screen.getByText("Create account and join")).toBeDisabled();

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "New Person" } });
    fireEvent.change(inputs[1], { target: { value: "longenough" } });
    fireEvent.click(screen.getByText("Create account and join"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/invitations/accept",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "good-token", name: "New Person", password: "longenough" }),
        })
      )
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the server error when account creation fails", async () => {
    searchParamsMock.mockReturnValue(paramsWithToken("good-token"));
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated", update: updateSessionMock });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => invitationInfo })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "email already registered" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<InviteAcceptPage />);
    await screen.findByText("Create account and join");

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "New Person" } });
    fireEvent.change(inputs[1], { target: { value: "longenough" } });
    fireEvent.click(screen.getByText("Create account and join"));

    await waitFor(() => expect(screen.getByText("email already registered")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });
});

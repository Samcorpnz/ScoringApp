import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { OrgSwitcher } from "../OrgSwitcher";

const { useSessionMock, updateMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OrgSwitcher", () => {
  it("renders nothing when the user has fewer than 2 memberships", () => {
    useSessionMock.mockReturnValue({
      data: { user: { activeOrgId: "org1", memberships: [{ orgId: "org1", orgName: "Org One" }] } },
      update: updateMock,
    });
    const { container } = render(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no session", () => {
    useSessionMock.mockReturnValue({ data: null, update: updateMock });
    const { container } = render(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a select with an option per membership when 2+ memberships exist", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          activeOrgId: "org1",
          memberships: [
            { orgId: "org1", orgName: "Org One" },
            { orgId: "org2", orgName: "Org Two" },
          ],
        },
      },
      update: updateMock,
    });
    render(<OrgSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("org1");
    expect(screen.getByText("Org One")).toBeInTheDocument();
    expect(screen.getByText("Org Two")).toBeInTheDocument();
  });

  it("switches org: posts to the switch-org endpoint, updates the session, and reloads", async () => {
    const reloadMock = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    Object.defineProperty(globalThis, "location", {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });

    useSessionMock.mockReturnValue({
      data: {
        user: {
          activeOrgId: "org1",
          memberships: [
            { orgId: "org1", orgName: "Org One" },
            { orgId: "org2", orgName: "Org Two" },
          ],
        },
      },
      update: updateMock.mockResolvedValue(undefined),
    });
    render(<OrgSwitcher />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "org2" } });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/session/switch-org",
      expect.objectContaining({ method: "POST" })
    ));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ activeOrgId: "org2" }));
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
  });

  it("does nothing when selecting the already-active org", () => {
    vi.stubGlobal("fetch", vi.fn());
    useSessionMock.mockReturnValue({
      data: {
        user: {
          activeOrgId: "org1",
          memberships: [
            { orgId: "org1", orgName: "Org One" },
            { orgId: "org2", orgName: "Org Two" },
          ],
        },
      },
      update: updateMock,
    });
    render(<OrgSwitcher />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "org1" } });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not update the session when the switch-org request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    useSessionMock.mockReturnValue({
      data: {
        user: {
          activeOrgId: "org1",
          memberships: [
            { orgId: "org1", orgName: "Org One" },
            { orgId: "org2", orgName: "Org Two" },
          ],
        },
      },
      update: updateMock,
    });
    render(<OrgSwitcher />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "org2" } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(updateMock).not.toHaveBeenCalled();
  });
});

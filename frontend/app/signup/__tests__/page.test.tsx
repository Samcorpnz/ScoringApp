import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import SignupPage from "../page";

const { pushMock, signInMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  signInMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

function fillForm(container: HTMLElement, overrides: Partial<Record<"name" | "orgName" | "email" | "password", string>> = {}) {
  const values = {
    name: "Sam Kerins",
    orgName: "Samcorp",
    email: "sam@example.com",
    password: "password123",
    ...overrides,
  };
  const inputs = container.querySelectorAll("input");
  fireEvent.change(inputs[0], { target: { value: values.name } });
  fireEvent.change(inputs[1], { target: { value: values.orgName } });
  fireEvent.change(inputs[2], { target: { value: values.email } });
  fireEvent.change(inputs[3], { target: { value: values.password } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SignupPage", () => {
  it("shows required-field errors after blurring empty fields and disables submit", () => {
    const { container } = render(<SignupPage />);
    const inputs = container.querySelectorAll("input");
    inputs.forEach(input => fireEvent.blur(input));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Organization name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeDisabled();
  });

  it("flags a too-short password as invalid", () => {
    const { container } = render(<SignupPage />);
    const passwordInput = container.querySelectorAll("input")[3];
    fireEvent.change(passwordInput, { target: { value: "short" } });
    fireEvent.blur(passwordInput);
    expect(screen.getByText("Must be at least 8 characters")).toBeInTheDocument();
  });

  it("flags a malformed email as invalid", () => {
    const { container } = render(<SignupPage />);
    const emailInput = container.querySelectorAll("input")[2];
    fireEvent.change(emailInput, { target: { value: "nope" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
  });

  it("submits to /api/signup, signs in, and redirects to /setup on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    signInMock.mockResolvedValue({ error: undefined });

    const { container } = render(<SignupPage />);
    fillForm(container);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/signup",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Sam Kerins",
            orgName: "Samcorp",
            email: "sam@example.com",
            password: "password123",
          }),
        })
      )
    );
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        email: "sam@example.com",
        password: "password123",
        redirect: false,
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/setup"));
  });

  it("shows the server's error message when /api/signup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "email already in use" }) })
    );

    const { container } = render(<SignupPage />);
    fillForm(container);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(screen.getByText("email already in use")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a fallback error message when signup succeeds but sign-in fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    signInMock.mockResolvedValue({ error: "CredentialsSignin" });

    const { container } = render(<SignupPage />);
    fillForm(container);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(screen.getByText("Account created — please sign in.")).toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not submit while the form is invalid", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SignupPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

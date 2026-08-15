import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import SignupPage from "../page";

function fillForm(container: HTMLElement, overrides: Partial<Record<"name" | "orgName" | "email", string>> = {}) {
  const values = {
    name: "Sam Kerins",
    orgName: "Samcorp",
    email: "sam@example.com",
    ...overrides,
  };
  const inputs = container.querySelectorAll("input");
  fireEvent.change(inputs[0], { target: { value: values.name } });
  fireEvent.change(inputs[1], { target: { value: values.orgName } });
  fireEvent.change(inputs[2], { target: { value: values.email } });
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
    expect(screen.getByRole("button", { name: "Create Account" })).toBeDisabled();
  });

  it("flags a malformed email as invalid", () => {
    const { container } = render(<SignupPage />);
    const emailInput = container.querySelectorAll("input")[2];
    fireEvent.change(emailInput, { target: { value: "nope" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
  });

  it("requires the terms checkbox before submitting", () => {
    const { container } = render(<SignupPage />);
    fillForm(container);
    const checkbox = container.querySelector('input[type="checkbox"]')!;
    fireEvent.blur(checkbox);
    expect(screen.getByText("You must agree to the terms and conditions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeDisabled();
  });

  it("submits to /api/signup and shows the check-your-email state on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const { container } = render(<SignupPage />);
    fillForm(container);
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
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
            acceptedTerms: true,
            turnstileToken: "",
          }),
        })
      )
    );
    await waitFor(() => expect(screen.getByText("Check your email")).toBeInTheDocument());
  });

  it("shows the server's error message when /api/signup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "email already in use" }) })
    );

    const { container } = render(<SignupPage />);
    fillForm(container);
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(screen.getByText("email already in use")).toBeInTheDocument());
  });

  it("does not submit while the form is invalid", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SignupPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

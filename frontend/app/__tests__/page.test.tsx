import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Home from "../page";

afterEach(cleanup);

describe("Home (root landing page)", () => {
  it("renders the ScoreHub wordmark and both auth links", () => {
    render(<Home />);
    expect(screen.getByText("Hub")).toBeInTheDocument();

    const getStarted = screen.getByText("Get Started").closest("a");
    expect(getStarted).toHaveAttribute("href", "/signup");

    const logIn = screen.getByText("Log In").closest("a");
    expect(logIn).toHaveAttribute("href", "/login");
  });

  it("renders all four sample preview cards with their sample scores", () => {
    render(<Home />);
    expect(screen.getByText("Basic Display")).toBeInTheDocument();
    expect(screen.getByText("Advanced Display")).toBeInTheDocument();
    expect(screen.getByText("Lower-Third Overlay")).toBeInTheDocument();
    expect(screen.getByText("Scorebug")).toBeInTheDocument();

    // Sample data (Sharks 47 v Magic 42) appears in multiple preview cards.
    expect(screen.getAllByText("Sharks").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Magic").length).toBeGreaterThan(0);
    expect(screen.getAllByText("47").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { formatStatLabel, orderStats, getGraphicsTemplate } from "../sport-graphics-templates";

describe("sport-graphics-templates", () => {
  it("uses a sport template's label when one exists", () => {
    expect(formatStatLabel("netball", "shootingPercentage")).toBe("Shooting %");
    expect(formatStatLabel("basketball", "fieldGoalsMade")).toBe("FG Made");
  });

  it("falls back to a camelCase-split label for a sport with no template", () => {
    expect(formatStatLabel("badminton", "someRandomStat")).toBe("Some Random Stat");
  });

  it("falls back to a camelCase-split label for an unmapped key on a sport that has a template", () => {
    expect(formatStatLabel("netball", "unmappedKey")).toBe("Unmapped Key");
  });

  it("orders known keys first per the template, then appends the rest in natural order", () => {
    const stats = { shootingPercentage: 90, squadName: "Mystics", goals: 40, mystery: 1 };
    const ordered = orderStats("netball", stats, "lowerThirdStats", ["squadName"]);
    expect(ordered.map(([k]) => k)).toEqual(["shootingPercentage", "goals", "mystery"]);
  });

  it("returns natural order (minus excludeKeys) when the sport has no template", () => {
    const stats = { foo: 1, bar: 2 };
    expect(orderStats("badminton", stats, "lowerThirdStats")).toEqual([["foo", 1], ["bar", 2]]);
  });

  it("returns an empty array for undefined stats", () => {
    expect(orderStats("netball", undefined, "playerCardStats")).toEqual([]);
  });

  it("every declared template exposes both stat-key orderings", () => {
    for (const sport of ["netball", "basketball", "cricket"] as const) {
      const template = getGraphicsTemplate(sport);
      expect(template?.lowerThirdStats.length).toBeGreaterThan(0);
      expect(template?.playerCardStats.length).toBeGreaterThan(0);
    }
  });
});

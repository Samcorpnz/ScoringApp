import { describe, it, expect } from "vitest";
import { getSceneComponent, SCENE_REGISTRY } from "../display/graphics/scenes/sceneRegistry";

describe("Graphics Operator add-on scene registry", () => {
  it("resolves known scene types", () => {
    expect(getSceneComponent("lowerThird")).toBeDefined();
    expect(getSceneComponent("playerStatCard")).toBeDefined();
    expect(getSceneComponent("playerHeadshotBio")).toBeDefined();
  });

  it("returns undefined for an unknown scene type rather than throwing", () => {
    expect(getSceneComponent("does-not-exist")).toBeUndefined();
    expect(getSceneComponent("")).toBeUndefined();
  });

  it("every registry entry is a defined component", () => {
    for (const [sceneType, Component] of Object.entries(SCENE_REGISTRY)) {
      expect(Component, `SCENE_REGISTRY["${sceneType}"]`).toBeDefined();
    }
  });
});

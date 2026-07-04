import type { ComponentType } from "react";
import type { SceneProps } from "./LowerThird";
import { LowerThird } from "./LowerThird";
import { PlayerStatCard } from "./PlayerStatCard";
import { PlayerHeadshotBio } from "./PlayerHeadshotBio";

// Config-driven scene lookup, mirroring the SPORT_TEMPLATES pattern in
// sport-templates.ts — adding a scene type is one entry here plus one new
// component, not a switch statement threaded through the display route.
export const SCENE_REGISTRY: Record<string, ComponentType<SceneProps>> = {
  lowerThird: LowerThird,
  playerStatCard: PlayerStatCard,
  playerHeadshotBio: PlayerHeadshotBio,
};

export function getSceneComponent(sceneType: string): ComponentType<SceneProps> | undefined {
  return SCENE_REGISTRY[sceneType];
}

export type { SceneProps };

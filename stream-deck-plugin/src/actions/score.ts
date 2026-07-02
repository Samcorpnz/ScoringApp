import {
  action,
  SingletonAction,
  type KeyAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type KeyDownEvent,
  type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { relay } from "../relay.js";
import type { MatchState } from "../types.js";

interface ScoreSettings {
  team?: "home" | "visitor";
  delta?: number;
}

function toScore(raw: Record<string, unknown>): ScoreSettings {
  return {
    team: (raw.team as "home" | "visitor" | undefined) ?? "home",
    delta: typeof raw.delta === "number" ? raw.delta : 1,
  };
}

@action({ UUID: "com.scorehub.sdplugin.score" })
export class ScoreAction extends SingletonAction {
  private unsubs = new Map<string, () => void>();

  onWillAppear(ev: WillAppearEvent): void {
    const id = ev.action.id;
    this.unsubs.get(id)?.();
    this.unsubs.set(
      id,
      relay.subscribe((state) =>
        this.render(ev.action as KeyAction, state, toScore(ev.payload.settings))
      )
    );
  }

  onWillDisappear(ev: WillDisappearEvent): void {
    this.unsubs.get(ev.action.id)?.();
    this.unsubs.delete(ev.action.id);
  }

  onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
    const state = relay.getState();
    if (state) this.render(ev.action as KeyAction, state, toScore(ev.payload.settings));
  }

  private render(action: KeyAction, state: MatchState, settings: ScoreSettings): void {
    const team = settings.team ?? "home";
    const delta = settings.delta ?? 1;
    const teamData = state[team];
    const name = (teamData.name || team.toUpperCase()).slice(0, 6);
    const sign = delta > 0 ? `+${delta}` : String(delta);
    action.setTitle(`${name}\n${teamData.score}\n${sign}`);
  }

  async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const { team = "home", delta = 1 } = toScore(ev.payload.settings);
    await relay.callAction(`score/${team}`, { delta });
  }
}

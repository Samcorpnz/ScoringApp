import { action, SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent, type KeyDownEvent } from "@elgato/streamdeck";
import { relay } from "../relay.js";
import type { MatchState } from "../types.js";

@action({ UUID: "com.scorehub.sdplugin.clock" })
export class ClockAction extends SingletonAction {
  private unsub?: () => void;

  onWillAppear(ev: WillAppearEvent): void {
    this.unsub = relay.subscribe((state: MatchState) => {
      // Buttons can be KeyAction or DialAction; setState only exists on KeyAction
      const key = ev.action as KeyAction;
      key.setState(state.isRunning ? 1 : 0);
      key.setTitle(state.isRunning ? "■ STOP" : "▶ START");
    });
  }

  onWillDisappear(_ev: WillDisappearEvent): void {
    this.unsub?.();
    this.unsub = undefined;
  }

  async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    await relay.callAction("toggle");
  }
}

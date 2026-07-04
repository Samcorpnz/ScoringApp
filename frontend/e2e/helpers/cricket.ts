import type { Page } from "@playwright/test";

export type BallOutcome = 0 | 1 | 2 | 3 | 4 | 6;
export type Modifier = "none" | "wide" | "noBall" | "bye" | "legBye";
export type WicketType =
  | "bowled" | "caught" | "lbw" | "run out" | "stumped"
  | "hit wicket" | "obstructed field" | "handled ball";

export async function startInnings(page: Page): Promise<void> {
  await page.getByTestId("cricket-start-innings").click();
}

export async function bowlBall(page: Page, opts: { runs: BallOutcome; modifier?: Modifier }): Promise<void> {
  if (opts.modifier && opts.modifier !== "none") {
    await page.getByTestId(`cricket-modifier-${opts.modifier}`).click();
  }
  await page.getByTestId(`cricket-runs-${opts.runs}`).click();
}

export async function takeWicket(page: Page, opts: { type: WicketType; nextBatterIndex?: number }): Promise<void> {
  await page.getByTestId("cricket-wicket-open").click();
  const typeSlug = opts.type.replace(/ /g, "_");
  await page.getByTestId(`cricket-wicket-type-${typeSlug}`).click();
  if (opts.nextBatterIndex !== undefined) {
    await page.getByTestId("cricket-next-batter-select").selectOption(String(opts.nextBatterIndex));
  }
  await page.getByTestId("cricket-wicket-confirm").click();
}

export async function completeOver(page: Page, nextBowlerIndex: number): Promise<void> {
  await page.getByTestId("cricket-bowler-select").selectOption(String(nextBowlerIndex));
  await page.getByTestId("cricket-bowler-set").click();
}

export async function startNextInnings(page: Page): Promise<void> {
  await page.getByTestId("cricket-start-next-innings").click();
}

export async function declareInnings(page: Page): Promise<void> {
  await page.getByTestId("cricket-declare").click();
}

export async function getScoreText(page: Page): Promise<string> {
  return (await page.getByTestId("cricket-score").textContent()) ?? "";
}

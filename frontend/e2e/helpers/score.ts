import type { Page } from "@playwright/test";

type Side = "home" | "visitor";

export async function clickScoreIncrement(page: Page, side: Side, amount: number): Promise<void> {
  await page.getByTestId(`score-${side}-inc-${amount}`).click();
}

export async function clickScoreDecrement(page: Page, side: Side, amount: number): Promise<void> {
  await page.getByTestId(`score-${side}-dec-${amount}`).click();
}

export async function getScore(page: Page, side: Side): Promise<number> {
  const text = await page.getByTestId(`score-${side}-value`).textContent();
  return Number(text);
}

export async function toggleClock(page: Page): Promise<void> {
  await page.getByTestId("score-start-stop").click();
}

export async function endPeriod(page: Page): Promise<void> {
  await page.getByTestId("score-end-period").click();
}

export async function reopenPeriod(page: Page): Promise<void> {
  await page.getByTestId("score-reopen-period").click();
}

export async function undo(page: Page): Promise<void> {
  await page.getByTestId("score-undo").click();
}

export async function resetMatch(page: Page): Promise<void> {
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("score-reset-match").click();
}

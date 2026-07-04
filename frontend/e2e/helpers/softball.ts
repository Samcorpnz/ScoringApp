import type { Page } from "@playwright/test";

export async function pitchBall(page: Page): Promise<void> {
  await page.getByTestId("softball-ball").click();
}

export async function pitchStrike(page: Page): Promise<void> {
  await page.getByTestId("softball-strike").click();
}

export async function recordOut(page: Page): Promise<void> {
  await page.getByTestId("softball-out").click();
}

export async function nextBatter(page: Page): Promise<void> {
  await page.getByTestId("softball-next-batter").click();
}

export async function endHalfInning(page: Page): Promise<void> {
  await page.getByTestId("softball-end-half-inning").click();
}

export async function addRun(page: Page, side: "home" | "visitor"): Promise<void> {
  await page.getByTestId(`softball-${side}-run-inc`).click();
}

export async function getRuns(page: Page, side: "home" | "visitor"): Promise<number> {
  const text = await page.getByTestId(`softball-${side}-score`).textContent();
  return Number(text);
}

import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, waitForLive } from "../helpers/match";
import { addRun, endHalfInning, pitchBall, pitchStrike, recordOut } from "../helpers/softball";

test.describe("softball", () => {
  test("fastpitch: ball/strike/out tracking and inning advance", async ({ page }) => {
    await createMatch(page, {
      sport: "softball",
      matchConfig: { format: "fastpitch" },
      matchName: "E2E Softball Fastpitch",
      homeName: "Comets",
      visitorName: "Bandits",
    });
    await waitForLive(page);

    // Fastpitch counts start at 0-0 (slowpitch starts at 1-1 by rule)
    await expect(page.getByText("TOP of 7")).toBeVisible();
    await expect(page.getByTestId("softball-balls")).toHaveText("0");
    await pitchBall(page);
    await expect(page.getByTestId("softball-balls")).toHaveText("1");
    await pitchStrike(page);
    await expect(page.getByTestId("softball-strikes")).toHaveText("1");
    await recordOut(page);
    await expect(page.getByTestId("softball-outs")).toHaveText("1");

    await addRun(page, "visitor");
    await expect.poll(async () => Number(await page.getByTestId("softball-visitor-score").textContent())).toBe(1);

    await endHalfInning(page);
    await expect(page.getByText("BOTTOM of 7")).toBeVisible();

    await endMatch(page);
  });

  test("slowpitch: 6 innings and counts start at 1-1", async ({ page }) => {
    await createMatch(page, {
      sport: "softball",
      matchConfig: { format: "slowpitch" },
      matchName: "E2E Softball Slowpitch",
      homeName: "Comets",
      visitorName: "Bandits",
    });
    await waitForLive(page);

    await expect(page.getByText("TOP of 6")).toBeVisible();
    await expect(page.getByText("Format: slowpitch")).toBeVisible();

    await endMatch(page);
  });
});

import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, waitForLive } from "../helpers/match";
import { clickScoreIncrement, endPeriod } from "../helpers/score";

// Basketball has no bespoke CustomPanel (unlike cricket/softball) — it's
// inline-special-cased inside the generic ScoreTab (frontend/app/control/components/ScoreTab.tsx),
// which makes it easy to silently break: the "Fouls" label (not "Faults"),
// the 3-increment FT/2PT/3PT scoring, and quarter-end foul reset all hinge
// on `state.sport === "basketball"` actually reaching the client — exactly
// the field the setup->control race condition used to drop before it was fixed.
test.describe("basketball", () => {
  test("uses Fouls label and 3-point scoring, not the generic Faults/2-increment default", async ({ page }) => {
    await createMatch(page, { sport: "basketball", matchName: "E2E Basketball", homeName: "Hawks", visitorName: "Falcons" });
    await waitForLive(page);

    // Basketball template has 3 score increments (FT/2PT/3PT) — a sport
    // that silently fell back to the generic default would only show 2.
    await expect(page.getByTestId("score-home-inc-3")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Fouls: 0/ }).first()).toBeVisible();

    await clickScoreIncrement(page, "home", 3);
    await expect.poll(async () => Number(await page.getByTestId("score-home-value").textContent())).toBe(3);

    await page.getByRole("button", { name: /^Fouls: 0/ }).first().click();
    await expect(page.getByRole("button", { name: /^Fouls: 1/ }).first()).toBeVisible();

    await endMatch(page);
  });

  test("resets team fouls to 0 at quarter end", async ({ page }) => {
    await createMatch(page, { sport: "basketball", matchName: "E2E Basketball Fouls", homeName: "Hawks", visitorName: "Falcons" });
    await waitForLive(page);

    await page.getByRole("button", { name: /^Fouls: 0/ }).first().click();
    await expect(page.getByRole("button", { name: /^Fouls: 1/ }).first()).toBeVisible();

    await endPeriod(page);
    await expect(page.getByRole("button", { name: /^Fouls: 0/ }).first()).toBeVisible();

    await endMatch(page);
  });
});

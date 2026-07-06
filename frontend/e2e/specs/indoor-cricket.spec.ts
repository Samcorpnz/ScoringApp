import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, waitForLive } from "../helpers/match";
import { clickScoreIncrement } from "../helpers/score";

// Indoor cricket has no bespoke CustomPanel — like basketball, it's
// inline-special-cased inside the generic ScoreTab (isIndoorCricket branch),
// gated on both state.sport and state.sportConfig.wicketPenalty reaching the
// client correctly.
test.describe("indoor cricket", () => {
  for (const [penalty, label] of [["5", "Cricket NZ standard"], ["2", "ICF international"]] as const) {
    test(`wicketPenalty=${penalty} (${label}): score clamps at 0 and wickets track per side`, async ({ page }) => {
      await createMatch(page, {
        sport: "indoor_cricket",
        matchConfig: { wicketPenalty: penalty },
        matchName: `E2E Indoor Cricket -${penalty}`,
        homeName: "Vipers",
        visitorName: "Cobras",
      });
      await waitForLive(page);

      await expect(page.getByRole("button", { name: new RegExp(`Wicket \\(-${penalty}\\)\\s*·\\s*0`) }).first()).toBeVisible();

      await clickScoreIncrement(page, "home", 1);
      await page.getByTestId("score-home-wicket").click();

      // formatScore() renders indoor cricket as "score/wickets" (frontend/app/types.ts)
      const expectedHomeScore = Math.max(0, 1 - Number(penalty));
      await expect(page.getByTestId("score-home-value")).toHaveText(`${expectedHomeScore}/1`);
      await expect(page.getByTestId("score-home-wicket")).toContainText("· 1");
      // Visitor wicket count must stay independent of home's
      await expect(page.getByTestId("score-visitor-wicket")).toContainText("· 0");

      await endMatch(page);
    });
  }

  test("rapid double-click on Wicket applies both wickets atomically, not one", async ({ page }) => {
    await createMatch(page, {
      sport: "indoor_cricket",
      matchConfig: { wicketPenalty: "5" },
      matchName: "E2E Indoor Cricket Rapid Wicket",
      homeName: "Vipers",
      visitorName: "Cobras",
    });
    await waitForLive(page);

    const wicketButton = page.getByTestId("score-home-wicket");
    await Promise.all([wicketButton.click(), wicketButton.click()]);
    await page.waitForTimeout(500);

    // Two rapid wicket clicks: both the score decrement (2 x penalty) and
    // the wicket-count increment (+2) are applied atomically server-side
    // (indoorCricket:wicket), not coalesced into a single wicket.
    await expect(page.getByTestId("score-home-wicket")).toContainText("· 2");
    await expect(page.getByTestId("score-visitor-wicket")).toContainText("· 0");

    await endMatch(page);
  });
});

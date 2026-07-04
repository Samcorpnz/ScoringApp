import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, getOrgId, openDisplay, waitForLive } from "../helpers/match";
import { clickScoreIncrement, endPeriod, getScore } from "../helpers/score";
import { SPORT_TEMPLATES } from "../../app/sport-templates";

// Cricket, softball, indoor_cricket, and basketball get dedicated specs
// (bespoke control panels or inline sport-specific behavior worth its own
// assertions). Every other sport template renders through the fully generic
// ScoreTab, so one parameterized test gives full coverage of that path.
const BESPOKE_SPORTS = new Set(["cricket", "softball", "indoor_cricket", "basketball"]);
const GENERIC_SPORTS = SPORT_TEMPLATES.filter(t => !BESPOKE_SPORTS.has(t.sport));

test.describe("generic sport match creation", () => {
  for (const template of GENERIC_SPORTS) {
    test(`${template.sport}: create, score, verify on display, end period, end match`, async ({ page }) => {
      const { matchId } = await createMatch(page, {
        sport: template.sport,
        matchName: `E2E ${template.label}`,
        homeName: `${template.label} Home`,
        visitorName: `${template.label} Visitor`,
      });
      await waitForLive(page);

      const increment = template.scoreIncrements[0];
      await clickScoreIncrement(page, "home", increment);
      await clickScoreIncrement(page, "visitor", increment);
      await expect.poll(() => getScore(page, "home")).toBe(increment);
      await expect.poll(() => getScore(page, "visitor")).toBe(increment);

      const orgId = await getOrgId(page);
      const displayPage = await page.context().newPage();
      await openDisplay(displayPage, { kind: "basic", org: orgId, matchId });
      await expect(displayPage.getByText(String(increment)).first()).toBeVisible({ timeout: 10_000 });
      await displayPage.close();

      await endPeriod(page);
      await endMatch(page);
      await expect(page).toHaveURL(/\/dashboard/);
    });
  }
});

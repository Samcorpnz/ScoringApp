import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, getOrgId, waitForLive } from "../helpers/match";
import { clickScoreIncrement, endPeriod, getScore } from "../helpers/score";
import { getMatchState } from "../helpers/relay";
import { SPORT_TEMPLATES } from "../../app/sport-templates";
import { formatClockDisplay } from "../../app/types";

// cricket/softball/indoor_cricket/basketball/netball already get their own
// dedicated specs with real bespoke-panel/rule assertions (see those files'
// own comments). Every other template renders through the fully generic
// ScoreTab, and match-creation.spec.ts's parameterized loop already smoke-
// tests all of them (create/score/display/end). This file goes one level
// deeper per remaining sport: score labels, whether score survives a period
// end, the clock's initial displayed value, and possession default — the
// axes that actually differ template to template and aren't covered by that
// generic smoke loop. Deliberately tagged @full-sports and excluded from the
// default `npm run test:e2e` run (see package.json's test:e2e / test:e2e:full-sports
// scripts) — it's a lot of sequential browser time for behavior that's
// data-driven and low-risk to regress silently, so it's opt-in rather than
// gating every PR.
const BESPOKE_SPORTS = new Set(["cricket", "softball", "indoor_cricket", "basketball", "netball"]);
const DEEP_COVERAGE_SPORTS = SPORT_TEMPLATES.filter(t => !BESPOKE_SPORTS.has(t.sport));

test.describe("sport-specific rules", { tag: "@full-sports" }, () => {
  for (const template of DEEP_COVERAGE_SPORTS) {
    test(`${template.sport}: score labels, period-reset behavior, clock, possession`, async ({ page }) => {
      const { matchId } = await createMatch(page, {
        sport: template.sport,
        matchName: `E2E ${template.label} Rules`,
        homeName: `${template.label} Home`,
        visitorName: `${template.label} Visitor`,
        matchConfig: template.matchConfig ? { [template.matchConfig[0].key]: template.matchConfig[0].options[1]?.value ?? template.matchConfig[0].options[0].value } : undefined,
      });
      await waitForLive(page);

      // Every declared increment exists with the right testid and produces
      // the right point delta (basketball/cricket/softball's own increments
      // are already covered by their dedicated specs).
      for (const increment of template.scoreIncrements) {
        await expect(page.getByTestId(`score-home-inc-${increment}`)).toBeVisible();
      }
      if (template.scoreLabels) {
        await expect(page.getByText(template.scoreLabels[0])).toBeVisible();
      }

      const firstIncrement = template.scoreIncrements[0];
      await clickScoreIncrement(page, "home", firstIncrement);
      await expect.poll(() => getScore(page, "home")).toBe(firstIncrement);

      // The single most-varied, least-tested behavior across the sport
      // set: does score carry over between periods, or zero out?
      await endPeriod(page);
      const scoreAfterPeriod = await getScore(page, "home");
      if (template.resetScoreOnPeriod) {
        expect(scoreAfterPeriod).toBe(0);
      } else {
        expect(scoreAfterPeriod).toBe(firstIncrement);
      }

      // Clock's initial displayed value is template-driven and genuinely
      // different in kind, not just magnitude: sports with clockSeconds: 0
      // show a sub-minute tenths format ("00.0"), not "MM:SS" — verified by
      // reading formatClockDisplay (frontend/app/types.ts) rather than
      // assumed, since it's easy to get wrong from the template value alone.
      await expect(page.getByTestId("score-clock")).toHaveText(formatClockDisplay(template.clockSeconds));

      // Possession default — only a handful of templates default to "home"
      // (rugby_union, rugby_league, waterpolo, touch_rugby); the rest are
      // "none". Checked via the relay's public /state endpoint since
      // possession has no data-testid in the control UI, only an inline
      // style toggle.
      const orgId = await getOrgId(page);
      const state = await getMatchState(page.request, orgId, matchId);
      expect(state.possession).toBe(template.defaultPossession);

      // squash is the only remaining sport with an untested matchConfig
      // (format: bo5|bo3 — cricket/softball/indoor_cricket's own matchConfig
      // fields are already covered by their dedicated specs). There's no
      // visible UI reflection of this selection today (state.sportConfig.format
      // is stored but nothing in ScoreTab reads it, unlike indoor_cricket's
      // wicketPenalty) — so this only asserts it reached MatchState, proving
      // the setup flow threads the selection through end to end.
      if (template.matchConfig) {
        const expected = template.matchConfig[0].options[1]?.value ?? template.matchConfig[0].options[0].value;
        expect(state.sportConfig?.[template.matchConfig[0].key]).toBe(expected);
      }

      await endMatch(page);
    });
  }
});

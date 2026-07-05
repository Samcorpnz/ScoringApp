import path from "path";
import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, getOrgId, openControl, openDisplay, waitForLive } from "../helpers/match";
import { grantAddOn, grantPlan, revokeAddOn } from "../helpers/billing";
import { getControlToken, pushGraphicsFeed, addRosterPlayer } from "../helpers/graphics";
import type { GraphicsFeed } from "../../app/types";

const TEST_PHOTO = path.join(__dirname, "../fixtures/files/test-logo.png");

// This suite reuses one signed-up org for the whole worker's lifetime (see
// fixtures/auth.ts), so every test sets the plan/add-on state it needs
// explicitly rather than relying on what an earlier test (in this file or
// elsewhere) left behind.
test.describe("graphics", () => {
  test("switches scenes from /control/graphics and they render on /display/graphics", async ({ page }) => {
    const { matchId } = await createMatch(page, {
      sport: "netball", matchName: "E2E Graphics", homeName: "Graphics Home", visitorName: "Graphics Visitor",
    });
    await waitForLive(page);
    const orgId = await getOrgId(page);

    await grantPlan(orgId, "pro");
    await grantAddOn(orgId, "graphics-operator");

    // displayName deliberately differs from the feed's own player name below
    // (name: "Feed Player One") — the scene components prefer the roster
    // match's displayName when one exists, so asserting "Roster Player"
    // rather than "Feed Player One" proves the roster join actually happened.
    const playerId = await addRosterPlayer(page, orgId, {
      firstName: "Roster", lastName: "Player", displayName: "Roster Player", externalId: "feed-p1",
    });

    // Upload the roster player's headshot before pushing the feed — the
    // Headshot+Bio scene only shows a photo when a roster match exists.
    await page.goto("/control/roster");
    await page.getByTestId(`player-photo-input-${playerId}`).setInputFiles(TEST_PHOTO);
    await expect(page.locator(`[data-testid="player-card-${playerId}"] img`)).toBeVisible({ timeout: 10_000 });

    const feed: GraphicsFeed = {
      provider: "e2e-mock-provider",
      sport: "netball",
      version: 1,
      capturedAt: new Date().toISOString(),
      stats: {
        team: { home: {}, visitor: {} },
        players: [{ id: "feed-p1", name: "Feed Player One", team: "home", stats: { position: "GS" } }],
      },
    };
    const controlToken = await getControlToken(page, matchId);
    await pushGraphicsFeed(page, matchId, controlToken, feed);

    await page.goto(`/control/graphics?matchId=${matchId}`);
    await expect(page.getByTestId("scene-btn-statCard-feed-p1")).toBeVisible({ timeout: 10_000 });

    const displayPage = await page.context().newPage();
    await openDisplay(displayPage, { kind: "graphics", org: orgId, matchId });

    await page.getByTestId("scene-btn-lowerThird").click();
    await expect(displayPage.getByText("Graphics Home")).toBeVisible({ timeout: 10_000 });
    await expect(displayPage.getByText("Graphics Visitor")).toBeVisible();

    await page.getByTestId("scene-btn-clear").click();
    await expect(displayPage.getByText("Graphics Home")).toHaveCount(0, { timeout: 10_000 });

    await page.getByTestId("scene-btn-statCard-feed-p1").click();
    await expect(displayPage.getByText("Roster Player")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("scene-btn-headshotBio-feed-p1").click();
    await expect(displayPage.getByText("Roster Player")).toBeVisible({ timeout: 10_000 });
    await expect(displayPage.locator('img[alt="Roster Player"]')).toBeVisible({ timeout: 10_000 });

    await displayPage.close();

    // endMatch needs the scoring control page's tabs — navigate back there
    // from /control/graphics. This tab's earlier isControl socket already
    // disconnected on the way out (page.goto tears down JS state), so
    // reconnecting can hit the same controller-conflict race waitForLive
    // already handles — reuse it rather than assuming one click suffices.
    await openControl(page, matchId);
    await waitForLive(page);
    await endMatch(page);
  });

  test.describe("plan gating", () => {
    test("Pro plan without the graphics-operator add-on shows an upgrade prompt, not scenes", async ({ page }) => {
      const { matchId } = await createMatch(page, {
        sport: "netball", matchName: "E2E Graphics Gating", homeName: "Graphics Home", visitorName: "Graphics Visitor",
      });
      await waitForLive(page);
      const orgId = await getOrgId(page);

      await grantPlan(orgId, "pro");
      await revokeAddOn(orgId, "graphics-operator");

      await page.goto(`/control/graphics?matchId=${matchId}`);
      await expect(page.getByText("Unlock Graphics Control")).toBeVisible({ timeout: 10_000 });

      const displayPage = await page.context().newPage();
      await openDisplay(displayPage, { kind: "graphics", org: orgId, matchId });
      await expect(displayPage.getByText("Upgrade your plan to unlock the Graphics Operator add-on")).toBeVisible({ timeout: 10_000 });
      await displayPage.close();

      await openControl(page, matchId);
      await waitForLive(page);
      await endMatch(page);
    });
  });
});

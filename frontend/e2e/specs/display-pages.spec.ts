import { test, expect } from "../fixtures/auth";
import { createMatch, endMatch, getOrgId, openDisplay, waitForLive } from "../helpers/match";

test.describe("display pages", () => {
  test("all 5 generic layouts render for a live match", async ({ page }) => {
    const { matchId } = await createMatch(page, { sport: "netball", matchName: "E2E Display Netball", homeName: "Sharks", visitorName: "Eagles" });
    await waitForLive(page);
    const org = await getOrgId(page);

    for (const kind of ["basic", "advanced", "overlay", "scorebug", "fullscreen"] as const) {
      const displayPage = await page.context().newPage();
      await openDisplay(displayPage, { kind, org, matchId });
      await expect(displayPage.getByText("Sharks").first()).toBeVisible({ timeout: 10_000 });
      await expect(displayPage.getByText("Eagles").first()).toBeVisible();
      await displayPage.close();
    }

    await endMatch(page);
  });

  test("scorebug respects position and size query params without erroring", async ({ page }) => {
    const { matchId } = await createMatch(page, { sport: "netball", matchName: "E2E Scorebug Params", homeName: "Sharks", visitorName: "Eagles" });
    await waitForLive(page);
    const org = await getOrgId(page);

    for (const position of ["tr", "tl", "br", "bl"] as const) {
      for (const size of ["sm", "md", "lg"] as const) {
        const displayPage = await page.context().newPage();
        const errors: string[] = [];
        displayPage.on("pageerror", err => errors.push(String(err)));
        await openDisplay(displayPage, { kind: "scorebug", org, matchId, position, size });
        await expect(displayPage.getByText("Sharks")).toBeVisible({ timeout: 10_000 });
        expect(errors, `scorebug threw with position=${position}&size=${size}`).toEqual([]);
        await displayPage.close();
      }
    }

    await endMatch(page);
  });

  test("cricket stats render on /display/advanced for a cricket match", async ({ page }) => {
    const { matchId } = await createMatch(page, {
      sport: "cricket",
      matchName: "E2E Display Cricket",
      homeName: "Titans",
      visitorName: "Warriors",
      squads: { home: ["P1", "P2"], visitor: ["P3", "P4"] },
    });
    await waitForLive(page);
    const org = await getOrgId(page);

    const displayPage = await page.context().newPage();
    await openDisplay(displayPage, { kind: "advanced", org, matchId });
    await expect(displayPage.getByText(/batting/i).first()).toBeVisible({ timeout: 10_000 });
    await displayPage.close();

    await endMatch(page);
  });
});

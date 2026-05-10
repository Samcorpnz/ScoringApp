/**
 * Path 2 — Puppeteer scraper for ChampionData live web pages.
 *
 * Instead of parsing raw HTML (fragile, slow), we intercept the JSON
 * XHR/fetch responses the page makes to its own data API. This gives us
 * the same clean JSON structure as Path 1 without needing auth credentials.
 *
 * Env vars:
 *   CD_SCRAPE_URL   Full URL to the ChampionData match page
 *   CD_POLL_MS      Poll interval in ms (default 500)
 */

import puppeteer, { Browser, Page } from "puppeteer";
import { Socket } from "socket.io-client";
import { MatchState } from "../types";
import { parseChampionDataJson } from "../protocol/championDataParser";

export interface ScrapeSourceOptions {
  url: string;
  pollMs?: number;
}

export async function startScrapeSource(
  socket: Socket,
  getState: () => MatchState,
  setState: (s: MatchState) => void,
  options: ScrapeSourceOptions
): Promise<() => Promise<void>> {
  const { url, pollMs = 500 } = options;

  let browser: Browser | null = null;
  let page: Page | null = null;
  let active = true;

  // Latest intercepted JSON payload — updated via network interception
  let latestPayload: unknown = null;

  async function launchBrowser(): Promise<void> {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
    page = await browser.newPage();

    // Block images/fonts/stylesheets to speed up loading
    await page.setRequestInterception(true);
    page.on("request", req => {
      const type = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Intercept JSON responses from the ChampionData API
    page.on("response", async response => {
      if (!active) return;
      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("application/json")) return;
      const responseUrl = response.url();
      // ChampionData API responses contain sport stats — filter by payload shape
      try {
        const json = await response.json();
        if (json?.sport?.netballMatchStats) {
          latestPayload = json;
        }
      } catch {
        // not JSON or parse failed — ignore
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    console.log(`[cd-scrape] Page loaded: ${url}`);
  }

  async function poll(): Promise<void> {
    if (!active) return;

    try {
      // Trigger a page reload to force fresh data requests
      if (page && !page.isClosed()) {
        await page.reload({ waitUntil: "networkidle0", timeout: 10_000 });
      }
    } catch (err) {
      console.warn("[cd-scrape] Reload failed, relaunching browser:", (err as Error).message);
      await teardown();
      try {
        await launchBrowser();
      } catch (launchErr) {
        console.error("[cd-scrape] Relaunch failed:", (launchErr as Error).message);
      }
    }

    if (latestPayload) {
      try {
        const next = parseChampionDataJson(latestPayload, getState());
        setState(next);
        if (socket.connected) socket.emit("stateUpdate", next);
      } catch (parseErr) {
        console.warn("[cd-scrape] Parse error:", (parseErr as Error).message);
      }
    }

    if (active) setTimeout(() => poll(), pollMs);
  }

  async function teardown(): Promise<void> {
    try {
      if (page && !page.isClosed()) await page.close();
      if (browser) await browser.close();
    } catch {
      // best effort
    }
    page = null;
    browser = null;
  }

  console.log(`[cd-scrape] Launching browser for ${url} (${pollMs}ms interval)`);
  await launchBrowser();

  // Start the poll loop after initial page load
  setTimeout(() => poll(), pollMs);

  return async () => {
    active = false;
    await teardown();
  };
}

export function scrapeSourceOptionsFromEnv(): ScrapeSourceOptions {
  const url = process.env.CD_SCRAPE_URL;
  if (!url) throw new Error("CD_SCRAPE_URL is required for cd-scrape source");
  return {
    url,
    pollMs: parseInt(process.env.CD_POLL_MS ?? "500", 10),
  };
}

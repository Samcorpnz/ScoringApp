/**
 * downloads.scorehub.co.nz — branded redirect to the latest Bridge desktop
 * installer, published as a GitHub Release asset by the bridge-release CI
 * pipeline (SA-91). No installers are stored here; this Worker just resolves
 * "latest .dmg" / "latest .exe" and 302s to the real github.com URL, so the
 * control panel and help site can link to a stable, branded address instead
 * of a raw releases URL that changes with every version.
 */

export interface Env {
  GITHUB_REPO: string; // "Samcorpnz/ScoringApp"
  RELEASE_TAG_PREFIX: string; // "bridge-v"
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

const CACHE_TTL_SECONDS = 300;

type Platform = "mac" | "windows";

function matchAsset(assets: GitHubAsset[], platform: Platform): GitHubAsset | undefined {
  const extension = platform === "mac" ? ".dmg" : ".exe";
  return assets.find((asset) => asset.name.toLowerCase().endsWith(extension));
}

async function findLatestBridgeRelease(env: Env): Promise<GitHubRelease | undefined> {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/releases`, {
    headers: {
      "User-Agent": "scorehub-downloads-worker",
      Accept: "application/vnd.github+json",
    },
    cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
  });

  if (!response.ok) {
    throw new Error(`GitHub releases lookup failed: ${response.status}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  return releases.find(
    (release) =>
      !release.draft && !release.prerelease && release.tag_name.startsWith(env.RELEASE_TAG_PREFIX)
  );
}

function detectPlatform(userAgent: string | null): Platform {
  if (userAgent && /mac ?os|macintosh/i.test(userAgent)) return "mac";
  return "windows";
}

function notFound(message: string): Response {
  return new Response(message, { status: 404, headers: { "content-type": "text/plain" } });
}

async function handleDownload(platform: Platform, env: Env): Promise<Response> {
  const release = await findLatestBridgeRelease(env);
  if (!release) {
    return notFound(
      "No Bridge installer has been published yet. Check back soon, or see " +
        "https://help.scorehub.co.nz/connecting-the-bridge for manual setup instructions."
    );
  }

  const asset = matchAsset(release.assets, platform);
  if (!asset) {
    return notFound(`No ${platform} installer found in release ${release.tag_name}.`);
  }

  return Response.redirect(asset.browser_download_url, 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mac") return handleDownload("mac", env);
    if (url.pathname === "/windows") return handleDownload("windows", env);

    if (url.pathname === "/" || url.pathname === "") {
      return handleDownload(detectPlatform(request.headers.get("user-agent")), env);
    }

    return notFound("Not found. Try /mac or /windows.");
  },
};

"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 50 * 60 * 1000; // refresh well before the 1h server-side expiry

// A failed fetch (network hiccup, or a 429 from this route's own rate limit
// — e.g. an operator rapidly switching between matches, or SA-102's E2E
// suite creating many matches back-to-back) used to be silently swallowed
// with no retry until the next 50-minute refresh, leaving the control panel
// stuck offline for the remainder of the session. Retry with backoff instead.
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 20_000];

// Fetches a short-lived relay credential from /api/control-token (minted
// from the logged-in user's session) instead of a static shared secret.
// Passing matchId scopes the token to that one match; omitting it preserves
// the original single-match-per-org behavior.
export function useControlToken(matchId?: string): string {
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = matchId ? `/api/control-token?matchId=${encodeURIComponent(matchId)}` : "/api/control-token";
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;

    function scheduleRetry() {
      if (cancelled) return;
      const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
      retryAttempt++;
      retryTimer = setTimeout(fetchToken, delay);
    }

    async function fetchToken() {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          scheduleRetry();
          return;
        }
        const { token } = await res.json();
        if (cancelled) return;
        retryAttempt = 0;
        setToken(token);
      } catch {
        scheduleRetry();
      }
    }

    fetchToken();
    const interval = setInterval(fetchToken, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [matchId]);

  return token;
}

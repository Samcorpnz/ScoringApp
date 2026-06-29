"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 50 * 60 * 1000; // refresh well before the 1h server-side expiry

// Fetches a short-lived relay credential from /api/control-token (minted
// from the logged-in user's session) instead of a static shared secret.
// Passing matchId scopes the token to that one match; omitting it preserves
// the original single-match-per-org behavior.
export function useControlToken(matchId?: string): string {
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = matchId ? `/api/control-token?matchId=${encodeURIComponent(matchId)}` : "/api/control-token";

    async function fetchToken() {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const { token } = await res.json();
        if (!cancelled) setToken(token);
      } catch {
        // network hiccup — keep using the existing token until the next refresh
      }
    }

    fetchToken();
    const interval = setInterval(fetchToken, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [matchId]);

  return token;
}

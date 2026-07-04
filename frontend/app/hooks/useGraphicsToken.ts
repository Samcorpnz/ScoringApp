"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 50 * 60 * 1000; // refresh well before the 1h server-side expiry

// Fetches a short-lived relay credential from /api/graphics-token for the
// Graphics Operator add-on's control UI. Mirrors useControlToken.ts exactly
// — same refresh cadence, same matchId-scoping — just pointed at the
// graphics-token endpoint instead of control-token.
export function useGraphicsToken(matchId?: string): string {
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = matchId ? `/api/graphics-token?matchId=${encodeURIComponent(matchId)}` : "/api/graphics-token";

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

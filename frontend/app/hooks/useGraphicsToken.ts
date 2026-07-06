"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 50 * 60 * 1000; // refresh well before the 1h server-side expiry

export type GraphicsTokenStatus = "loading" | "ok" | "forbidden" | "error";

// Fetches a short-lived relay credential from /api/graphics-token for the
// Graphics Operator add-on's control UI. Mirrors useControlToken.ts's refresh
// cadence and matchId-scoping, but also surfaces entitlement status: the
// route 403s when the org doesn't have the graphics-operator add-on, which
// the control UI needs in order to show an upsell instead of a dead page.
export function useGraphicsToken(matchId?: string): { token: string; status: GraphicsTokenStatus } {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<GraphicsTokenStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const url = matchId ? `/api/graphics-token?matchId=${encodeURIComponent(matchId)}` : "/api/graphics-token";

    async function fetchToken() {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setStatus(res.status === 403 ? "forbidden" : "error");
          return;
        }
        const { token } = await res.json();
        if (!cancelled) {
          setToken(token);
          setStatus("ok");
        }
      } catch {
        // network hiccup — keep using the existing token/status until the next refresh
      }
    }

    fetchToken();
    const interval = setInterval(fetchToken, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [matchId]);

  return { token, status };
}

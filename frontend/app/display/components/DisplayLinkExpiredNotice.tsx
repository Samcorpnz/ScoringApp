// Shown when the relay rejects a display connection for a bad/missing
// displayToken (see DISPLAY_TOKEN_REQUIRED in relay/src/server.ts and
// useMatchState's `unauthorized` flag) — every /display/* page renders this
// instead of a blank screen once that flag is set. Styled after
// display/graphics/page.tsx's UpgradePrompt, the existing soft-degrade
// precedent for a session-less display page.
export function DisplayLinkExpiredNotice() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: "var(--bg-base, #07090f)" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "20px 32px",
          borderRadius: 12,
          background: "rgba(7,9,15,0.85)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
          textAlign: "center",
        }}
      >
        <span style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.02em", color: "var(--accent)" }}>
          ScoreHub
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", maxWidth: "28ch" }}>
          This display link is out of date. Get a fresh one from the control panel&apos;s Outputs tab.
        </span>
      </div>
    </div>
  );
}

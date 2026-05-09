"use client";

const links = [
  { href: "/control",               title: "Control Panel",        desc: "Operator view — scores, names, logos, colours, outputs.", highlight: true },
  { href: "/display/fullscreen",    title: "Fullscreen Display",   desc: "Second screen / projector / capture card. Press F for fullscreen." },
  { href: "/display/basic",         title: "Basic Display",        desc: "Clean scoreboard panel for venue screens." },
  { href: "/display/advanced",      title: "Advanced Display",     desc: "Full stats display with player roster and timeout pips." },
  { href: "/display/overlay",       title: "Lower-Third Overlay",  desc: "Transparent — OBS/vMix/Wirecast Browser Source (1920×120)." },
  { href: "/display/scorebug",      title: "Scorebug",             desc: "Compact corner widget for streaming overlays (?position=tr)." },
] as const;

export default function Home() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="max-w-2xl w-full">
        {/* Wordmark */}
        <div className="mb-12 text-center">
          <h1
            className="text-4xl font-black tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Score<span style={{ color: "var(--accent)" }}>board</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Live sport display system
          </p>
          <div
            className="mx-auto mt-4"
            style={{ width: 40, height: 2, background: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)" }}
          />
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="group rounded-xl p-5 flex flex-col gap-2 transition-all duration-200"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                textDecoration: "none",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--border-accent)";
                e.currentTarget.style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = (link as any).highlight ? "var(--border-accent)" : "var(--border)";
                e.currentTarget.style.background = (link as any).highlight ? "var(--accent-dim)" : "var(--bg-surface)";
              }}
            >
              <span
                className="text-base font-bold flex items-center gap-2"
                style={{ color: "var(--accent)" }}
              >
                {link.title}
                <span className="text-xs transition-transform group-hover:translate-x-1">→</span>
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {link.desc}
              </span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

"use client";

const SAMPLE_HOME = { name: "Sharks", score: 47, color: "#3b82f6" };
const SAMPLE_VISITOR = { name: "Magic", score: 42, color: "#ef4444" };

function LogoBadge({ initial, color, size = 28 }: { initial: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-black text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  );
}

const previews = [
  {
    title: "Basic Display",
    desc: "Clean scoreboard panel for venue screens.",
    render: () => (
      <div className="flex items-center gap-3 rounded-lg overflow-hidden" style={{ background: "#0a0e14", border: "1px solid #1f2937" }}>
        <div className="w-1 self-stretch" style={{ background: SAMPLE_HOME.color }} />
        <div className="flex-1 flex flex-col items-center gap-1 py-3">
          <LogoBadge initial="S" color={SAMPLE_HOME.color} />
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{SAMPLE_HOME.name}</p>
          <p className="text-xl font-black text-white">{SAMPLE_HOME.score}</p>
        </div>
        <div className="px-3 text-center" style={{ borderLeft: "1px solid #1f2937", borderRight: "1px solid #1f2937" }}>
          <p className="text-xs font-mono text-gray-300">08:42</p>
          <p className="text-[9px] text-gray-500">Q3</p>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 py-3">
          <LogoBadge initial="M" color={SAMPLE_VISITOR.color} />
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{SAMPLE_VISITOR.name}</p>
          <p className="text-xl font-black text-white">{SAMPLE_VISITOR.score}</p>
        </div>
        <div className="w-1 self-stretch" style={{ background: SAMPLE_VISITOR.color }} />
      </div>
    ),
  },
  {
    title: "Advanced Display",
    desc: "Full stats display with player roster and timeout pips.",
    render: () => (
      <div className="rounded-lg overflow-hidden p-3" style={{ background: "#0a0e14", border: "1px solid #1f2937" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 flex items-center justify-center gap-2">
            <LogoBadge initial="S" color={SAMPLE_HOME.color} size={22} />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{SAMPLE_HOME.name}</p>
              <p className="text-lg font-black text-white">{SAMPLE_HOME.score}</p>
            </div>
          </div>
          <p className="text-xs font-mono text-gray-300">08:42</p>
          <div className="flex-1 flex items-center justify-center gap-2">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{SAMPLE_VISITOR.name}</p>
              <p className="text-lg font-black text-white">{SAMPLE_VISITOR.score}</p>
            </div>
            <LogoBadge initial="M" color={SAMPLE_VISITOR.color} size={22} />
          </div>
        </div>
        <div className="flex justify-center gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < 2 ? "#3b82f6" : "#1f2937" }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Lower-Third Overlay",
    desc: "Transparent — OBS/vMix/Wirecast Browser Source (1920×120).",
    render: () => (
      <div
        className="flex items-center gap-3 rounded-md px-3 py-2"
        style={{ background: "linear-gradient(90deg, rgba(10,14,20,0.92), rgba(10,14,20,0.6))", border: "1px solid #1f2937" }}
      >
        <LogoBadge initial="S" color={SAMPLE_HOME.color} size={20} />
        <span className="text-xs font-bold text-white">{SAMPLE_HOME.name}</span>
        <span className="text-sm font-black" style={{ color: "#3b82f6" }}>{SAMPLE_HOME.score}</span>
        <span className="text-gray-500 text-xs">–</span>
        <span className="text-sm font-black" style={{ color: "#ef4444" }}>{SAMPLE_VISITOR.score}</span>
        <span className="text-xs font-bold text-white">{SAMPLE_VISITOR.name}</span>
        <LogoBadge initial="M" color={SAMPLE_VISITOR.color} size={20} />
        <span className="ml-auto text-[10px] font-mono text-gray-400">Q3 08:42</span>
      </div>
    ),
  },
  {
    title: "Scorebug",
    desc: "Compact corner widget for streaming overlays (?position=tr).",
    render: () => (
      <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 w-fit" style={{ background: "#0a0e14", border: "1px solid #1f2937" }}>
        <LogoBadge initial="S" color={SAMPLE_HOME.color} size={16} />
        <span className="text-[10px] font-bold text-gray-300">{SAMPLE_HOME.name}</span>
        <span className="text-xs font-black text-white">{SAMPLE_HOME.score}</span>
        <span className="text-[10px] font-black text-white">{SAMPLE_VISITOR.score}</span>
        <span className="text-[10px] font-bold text-gray-300">{SAMPLE_VISITOR.name}</span>
        <LogoBadge initial="M" color={SAMPLE_VISITOR.color} size={16} />
      </div>
    ),
  },
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
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--accent)" }}>
            SAMCORP
          </p>
          <h1
            className="text-4xl font-black tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Score<span style={{ color: "var(--accent)" }}>Hub</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Live sport display system
          </p>
          <div
            className="mx-auto mt-4"
            style={{ width: 40, height: 2, background: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)" }}
          />
        </div>

        {/* Sign up / log in */}
        <div className="flex gap-3 justify-center mb-12">
          <a
            href="/signup"
            className="rounded-xl px-6 py-3 text-sm font-black tracking-widest uppercase"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", textDecoration: "none" }}
          >
            Get Started
          </a>
          <a
            href="/login"
            className="rounded-xl px-6 py-3 text-sm font-bold"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Log In
          </a>
        </div>

        {/* Sample previews */}
        <div className="mb-4 text-center">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>
            See it in action
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {previews.map(preview => (
            <div
              key={preview.title}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{preview.title}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{preview.desc}</p>
              </div>
              {preview.render()}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

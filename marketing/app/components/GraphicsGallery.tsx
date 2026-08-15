const HOME = { name: "Sharks", score: 47, color: "#3b82f6" };
const VISITOR = { name: "Magic", score: 42, color: "#ef4444" };

function LogoBadge({ initial, color, size = 28 }: { readonly initial: string; readonly color: string; readonly size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        color: "#fff",
        background: color,
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

const previews = [
  {
    title: "Basic Display",
    desc: "Clean scoreboard panel for venue screens and projectors.",
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ width: 4, alignSelf: "stretch", background: HOME.color }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0" }}>
          <LogoBadge initial="S" color={HOME.color} />
          <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", margin: 0 }}>{HOME.name}</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>{HOME.score}</p>
        </div>
        <div style={{ padding: "0 12px", textAlign: "center", borderLeft: "1px solid #1f2937", borderRight: "1px solid #1f2937" }}>
          <p className="mono" style={{ fontSize: 12, color: "#d1d5db", margin: 0 }}>08:42</p>
          <p style={{ fontSize: 9, color: "#9ca3af", margin: 0 }}>Q3</p>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0" }}>
          <LogoBadge initial="M" color={VISITOR.color} />
          <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", margin: 0 }}>{VISITOR.name}</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>{VISITOR.score}</p>
        </div>
        <div style={{ width: 4, alignSelf: "stretch", background: VISITOR.color }} />
      </div>
    ),
  },
  {
    title: "Advanced Display",
    desc: "Full stats display with player roster and timeout tracking.",
    render: () => (
      <div style={{ borderRadius: 8, overflow: "hidden", padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <LogoBadge initial="S" color={HOME.color} size={22} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", color: "#9ca3af", margin: 0 }}>{HOME.name}</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>{HOME.score}</p>
            </div>
          </div>
          <p className="mono" style={{ fontSize: 12, color: "#d1d5db", margin: 0 }}>08:42</p>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", color: "#9ca3af", margin: 0 }}>{VISITOR.name}</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>{VISITOR.score}</p>
            </div>
            <LogoBadge initial="M" color={VISITOR.color} size={22} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 4 }} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < 2 ? "#3b82f6" : "#1f2937" }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Lower-Third Overlay",
    desc: "Transparent — OBS/vMix/Wirecast Browser Source (1920×120).",
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 6, padding: "8px 12px", }}>
        <LogoBadge initial="S" color={HOME.color} size={20} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{HOME.name}</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: HOME.color }}>{HOME.score}</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>–</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: VISITOR.color }}>{VISITOR.score}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{VISITOR.name}</span>
        <LogoBadge initial="M" color={VISITOR.color} size={20} />
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>Q3 08:42</span>
      </div>
    ),
  },
  {
    title: "Scorebug",
    desc: "Compact corner widget for streaming overlays (?position=tr).",
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "6px 8px", width: "fit-content" }}>
        <LogoBadge initial="S" color={HOME.color} size={16} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#d1d5db" }}>{HOME.name}</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{HOME.score}</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>{VISITOR.score}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#d1d5db" }}>{VISITOR.name}</span>
        <LogoBadge initial="M" color={VISITOR.color} size={16} />
      </div>
    ),
  },
  {
    title: "Netball Stats Panel",
    desc: "Live shooting %, centre-pass, and quarter-by-quarter breakdown.",
    render: () => (
      <div style={{ borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
          <span>Q1 12 · Q2 14 · Q3 11</span>
          <span className="mono">GS 78%</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{HOME.score}</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Centre pass: Sharks</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{VISITOR.score}</span>
        </div>
      </div>
    ),
  },
  {
    title: "Cricket Scorecard",
    desc: "Overs, run rate, and wicket-fall for indoor and outdoor cricket.",
    render: () => (
      <div style={{ borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>142/4</span>
          <span className="mono" style={{ fontSize: 12, color: "#9ca3af" }}>18.3 ov</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
          <span>RR 7.68</span>
          <span>Req RR 9.12</span>
        </div>
      </div>
    ),
  },
] as const;

export function GraphicsGallery() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "1rem",
      }}
    >
      {previews.map((preview) => (
        <div
          key={preview.title}
          style={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            padding: "1.1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.7rem",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--accent)" }}>{preview.title}</p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{preview.desc}</p>
          </div>
          <div className="browser-frame">
            <div className="browser-frame-bar" aria-hidden="true">
              <span className="browser-frame-dot" />
              <span className="browser-frame-dot" />
              <span className="browser-frame-dot" />
            </div>
            <div style={{ padding: 10 }}>{preview.render()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

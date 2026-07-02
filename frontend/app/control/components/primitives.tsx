export { Card, SectionLabel, SmallBtn } from "../../components/primitives";

export function TemplateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export function ColorSwatch({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: 32, height: 32, borderRadius: 8, background: color, boxShadow: `0 0 12px ${color}88` }} />
      <code className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>{color}</code>
    </div>
  );
}

export function ScoreButtons({ score, onAdjust, sport }: { score: number; onAdjust: (d: number) => void; sport?: string }) {
  if (sport === "netball") {
    return (
      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2">
          {[-2, -1].map(d => (
            <button key={d}
              className="rounded-xl py-4 text-xl font-black flex-1"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => onAdjust(d)}>{d}</button>
          ))}
          <div className="flex-1 text-center score-digit text-5xl" style={{ color: "var(--accent)" }}>{score}</div>
          {[1, 2].map(d => (
            <button key={d}
              className="rounded-xl py-4 text-xl font-black flex-1"
              style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
              onClick={() => onAdjust(d)}>+{d}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      {[-5, -1].map(d => (
        <button key={d}
          className="rounded-xl py-4 text-xl font-black flex-1"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onClick={() => onAdjust(d)}>{d}</button>
      ))}
      <div className="flex-1 text-center score-digit text-5xl" style={{ color: "var(--accent)" }}>{score}</div>
      {[1, 5].map(d => (
        <button key={d}
          className="rounded-xl py-4 text-xl font-black flex-1"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={() => onAdjust(d)}>+{d}</button>
      ))}
    </div>
  );
}

export function NameField({ label, value, placeholder, onChange, onCommit }: {
  label: string; value: string; placeholder: string;
  onChange: (v: string) => void; onCommit: () => void;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</p>
      <div className="flex gap-2">
        <input className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onCommit()} />
        <button className="rounded-lg px-3 py-2 text-xs font-bold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={onCommit}>Set</button>
      </div>
    </div>
  );
}

export function ClockAdjustButtons({ clockSeconds, onAdjust }: { clockSeconds: number; onAdjust: (d: number) => void }) {
  const adjustments = [-60, -10, -1, 1, 10, 60];
  return (
    <div className="flex items-center gap-1">
      {adjustments.map(d => (
        <button
          key={d}
          className="rounded-lg py-1.5 text-xs font-black flex-1"
          style={{
            background: d < 0 ? "var(--bg-elevated)" : "var(--accent-dim)",
            border: `1px solid ${d < 0 ? "var(--border)" : "var(--border-accent)"}`,
            color: d < 0 ? "var(--text-secondary)" : "var(--accent)",
          }}
          onClick={() => onAdjust(d)}
        >
          {d > 0 ? "+" : ""}{d < -59 || d > 59 ? `${d / 60}m` : `${d}s`}
        </button>
      ))}
    </div>
  );
}

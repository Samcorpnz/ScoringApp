export function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>{children}</p>
  );
}

export function Card({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function SmallBtn({ label, onClick, primary = false, active = false, testId }: {
  readonly label: string; readonly onClick: () => void; readonly primary?: boolean; readonly active?: boolean; readonly testId?: string;
}) {
  return (
    <button className="rounded-lg px-3 py-1.5 text-xs font-bold"
      data-testid={testId}
      style={{
        background: active || primary ? "var(--accent-dim)" : "var(--bg-elevated)",
        border: `1px solid ${active || primary ? "var(--border-accent)" : "var(--border)"}`,
        color: active || primary ? "var(--accent)" : "var(--text-secondary)",
      }}
      onClick={onClick}>
      {label}
    </button>
  );
}

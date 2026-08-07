"use client";

const SQUAD_SIZE = 11;

export function emptySquad(): string[] {
  return new Array(SQUAD_SIZE).fill("");
}

function missingPlayersMessage(filled: number, minPlayers: number): string {
  if (filled >= minPlayers) return "";
  const missing = minPlayers - filled;
  const playerWord = missing === 1 ? "player" : "players";
  return `Add ${missing} more ${playerWord}`;
}

export function CricketSquadSetup({
  homeTeamName, visitorTeamName, homeSquad, visitorSquad, onChangeHome, onChangeVisitor, onBack, onSubmit,
}: {
  readonly homeTeamName: string;
  readonly visitorTeamName: string;
  readonly homeSquad: string[];
  readonly visitorSquad: string[];
  readonly onChangeHome: (idx: number, name: string) => void;
  readonly onChangeVisitor: (idx: number, name: string) => void;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
}) {
  const MIN_PLAYERS = 2;
  const homeFilled = homeSquad.filter(n => n.trim()).length;
  const visitorFilled = visitorSquad.filter(n => n.trim()).length;
  const homeError = missingPlayersMessage(homeFilled, MIN_PLAYERS);
  const visitorError = missingPlayersMessage(visitorFilled, MIN_PLAYERS);
  const canSubmit = !homeError && !visitorError;

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-dim)" }}>Squads</p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Enter each team&apos;s batting order (up to 11 players). At least 2 per side to start —
          you can edit the rest from the Control Panel later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SquadColumn label={homeTeamName || "Home"} squad={homeSquad} onChange={onChangeHome} testIdPrefix="squad-home" error={homeError} />
        <SquadColumn label={visitorTeamName || "Visitor"} squad={visitorSquad} onChange={onChangeVisitor} testIdPrefix="squad-visitor" error={visitorError} />
      </div>

      <div className="flex gap-3">
        <button
          data-testid="squad-back"
          className="rounded-xl px-5 py-3 text-sm font-black tracking-widest uppercase"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onClick={onBack}
        >
          ↩ Back
        </button>
        <button
          data-testid="squad-submit"
          className="flex-1 rounded-xl py-3 text-sm font-black tracking-widest uppercase"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Start Match →
        </button>
      </div>
    </div>
  );
}

function SquadColumn({ label, squad, onChange, testIdPrefix, error }: {
  readonly label: string; readonly squad: string[]; readonly onChange: (idx: number, name: string) => void; readonly testIdPrefix: string; readonly error?: string;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-dim)" }}>{label}</p>
        {error && (
          <p className="text-xs font-semibold" style={{ color: "var(--danger)" }}>{error}</p>
        )}
      </div>
      <div className="space-y-2">
        {squad.map((name, idx) => (
          <input
            key={`${testIdPrefix}-${idx}`}
            data-testid={`${testIdPrefix}-player-${idx}`}
            className="w-full rounded-lg px-3 py-1.5 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            placeholder={`Player ${idx + 1}`}
            value={name}
            onChange={e => onChange(idx, e.target.value)}
          />
        ))}
      </div>
    </div>
  );
}

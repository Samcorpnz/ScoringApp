"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useMatchState } from "../../hooks/useMatchState";
import { useControlToken } from "../../hooks/useControlToken";
import { RELAY_URL } from "../lib/relay";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  externalId: string | null;
  provider: string | null;
  photoUrl: string | null;
  bio: string | null;
}

// Roster admin for the Graphics Operator add-on (Phase C) — a standalone
// route (like control/graphics), not a tab on the scoring control panel,
// since roster upkeep happens well before/after a live match, not during it.
export default function RosterControl() {
  useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/login?callbackUrl=/control/roster";
    },
  });

  const { data: session } = useSession();
  const orgId = session?.user?.activeOrgId;
  const controlToken = useControlToken();
  const { state } = useMatchState();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<{ name?: string; externalId?: string } | null>(null);

  const loadPlayers = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/players`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPlayers(data.players ?? []);
    } catch {
      setError("Failed to load roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlayers(); }, [orgId]);

  const deletePlayer = async (playerId: string) => {
    if (!orgId) return;
    if (!confirm("Remove this player from the roster?")) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/players/${playerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadPlayers();
    } catch {
      setError("Failed to remove player");
    }
  };

  // Live feed players with no roster match (by provider+externalId) — per
  // product decision, linking is manual only, no fuzzy name-matching.
  const feedPlayers = state.graphicsFeed?.stats.players ?? [];
  const unmatchedFeedPlayers = feedPlayers.filter(
    fp => !players.some(p => p.externalId === fp.id && p.provider === state.graphicsFeed?.provider)
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Player Roster</h1>
        <button
          onClick={() => { setEditing(null); setPrefill(null); setShowForm(true); }}
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", borderRadius: 8, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
        >
          + Add Player
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginBottom: 12 }}>{error}</p>}

      {unmatchedFeedPlayers.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>Live match — unmatched players</SectionLabel>
          <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", margin: "6px 0 10px" }}>
            These players appear in the live feed but aren&apos;t linked to a roster entry yet.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {unmatchedFeedPlayers.map(fp => (
              <UnmatchedCard
                key={fp.id}
                name={fp.name}
                team={fp.team}
                players={players}
                onLinkExisting={async (playerId) => {
                  if (!orgId) return;
                  await fetch(`/api/orgs/${orgId}/players/${playerId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ externalId: fp.id, provider: state.graphicsFeed?.provider }),
                  });
                  await loadPlayers();
                }}
                onCreateNew={() => {
                  setEditing(null);
                  setPrefill({ name: fp.name, externalId: fp.id });
                  setShowForm(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Roster ({players.length})</SectionLabel>
        {loading ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 8 }}>Loading…</p>
        ) : players.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 8 }}>No players yet — add one above.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginTop: 10 }}>
            {players.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                orgId={orgId}
                controlToken={controlToken}
                onEdit={() => { setEditing(p); setPrefill(null); setShowForm(true); }}
                onDelete={() => deletePlayer(p.id)}
                onPhotoUploaded={loadPlayers}
              />
            ))}
          </div>
        )}
      </section>

      {showForm && orgId && (
        <PlayerFormModal
          orgId={orgId}
          existing={editing}
          prefill={prefill}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await loadPlayers(); }}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
    </span>
  );
}

function UnmatchedCard({ name, team, players, onLinkExisting, onCreateNew }: {
  name: string;
  team: string;
  players: Player[];
  onLinkExisting: (playerId: string) => void;
  onCreateNew: () => void;
}) {
  const [selected, setSelected] = useState("");
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-dim)", textTransform: "uppercase" }}>{team}</div>
      </div>
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 6, padding: "4px 6px", fontSize: "0.75rem" }}
      >
        <option value="">Link to existing player…</option>
        {players.map(p => (
          <option key={p.id} value={p.id}>{p.displayName || `${p.firstName} ${p.lastName}`}</option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={!selected}
          onClick={() => selected && onLinkExisting(selected)}
          style={{ flex: 1, background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", borderRadius: 6, padding: "6px 8px", fontSize: "0.7rem", fontWeight: 700, cursor: selected ? "pointer" : "not-allowed", opacity: selected ? 1 : 0.5 }}
        >
          Link
        </button>
        <button
          onClick={onCreateNew}
          style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 6, padding: "6px 8px", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}
        >
          New player
        </button>
      </div>
    </div>
  );
}

function PlayerCard({ player, orgId, controlToken, onEdit, onDelete, onPhotoUploaded }: {
  player: Player;
  orgId?: string | null;
  controlToken: string;
  onEdit: () => void;
  onDelete: () => void;
  onPhotoUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!orgId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`${RELAY_URL}/api/player-photo/${player.id}`, {
        method: "POST",
        headers: { "x-control-secret": controlToken },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { photoUrl } = await res.json();
      await fetch(`/api/orgs/${orgId}/players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      onPhotoUploaded();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", gap: 10 }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-elevated)", flexShrink: 0, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}
      >
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photoUrl.startsWith("/player-photos/") ? `${RELAY_URL}${player.photoUrl}` : player.photoUrl} alt={player.firstName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>{uploading ? "…" : "+"}</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{player.displayName || `${player.firstName} ${player.lastName}`}</div>
        {player.provider && (
          <div style={{ fontSize: "0.6rem", color: "var(--text-dim)" }}>{player.provider} · {player.externalId}</div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={onEdit} style={{ fontSize: "0.65rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit</button>
          <button onClick={onDelete} style={{ fontSize: "0.65rem", color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

function PlayerFormModal({ orgId, existing, prefill, onClose, onSaved }: {
  orgId: string;
  existing: Player | null;
  prefill: { name?: string; externalId?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(existing?.firstName ?? prefill?.name?.split(/\s+/)[0] ?? "");
  const [lastName, setLastName] = useState(existing?.lastName ?? prefill?.name?.split(/\s+/).slice(1).join(" ") ?? "");
  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [externalId, setExternalId] = useState(existing?.externalId ?? prefill?.externalId ?? "");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { firstName, lastName, displayName: displayName || null, externalId: externalId || null, provider: provider || null, bio: bio || null };
      const res = existing
        ? await fetch(`/api/orgs/${orgId}/players/${existing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`/api/orgs/${orgId}/players`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, width: 360, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: "0.9rem", fontWeight: 800 }}>{existing ? "Edit Player" : "Add Player"}</h2>
        <FormField label="First name"><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></FormField>
        <FormField label="Last name"><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></FormField>
        <FormField label="Display name (optional)"><input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} /></FormField>
        <FormField label="Provider"><input value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. championdata" style={inputStyle} /></FormField>
        <FormField label="External ID"><input value={externalId} onChange={e => setExternalId(e.target.value)} style={inputStyle} /></FormField>
        <FormField label="Bio"><textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></FormField>
        {error && <p style={{ color: "var(--danger)", fontSize: "0.7rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 8, padding: "8px 0", fontSize: "0.8rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", borderRadius: 8, padding: "8px 0", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.7rem", color: "var(--text-dim)" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: "0.8rem",
};
